import json
import mimetypes
import socket
import ssl
import urllib.error
import urllib.request
from pathlib import Path

from llm_core.config import settings


class MWSClient:
    def __init__(self) -> None:
        self.base_url = settings.mws_base_url.rstrip("/")
        self.api_key = settings.mws_api_key
        self.timeout = settings.request_timeout_seconds
        self.image_timeout = settings.image_request_timeout_seconds
        self.verify_ssl = settings.verify_ssl

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def list_models(self) -> dict:
        request = urllib.request.Request(
            url=f"{self.base_url}/v1/models",
            headers=self._headers(),
            method="GET",
        )
        return self._send(request)

    def chat_completion(self, model: str, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        request = urllib.request.Request(
            url=f"{self.base_url}/v1/chat/completions",
            headers=self._headers(),
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
        )
        response = self._send(request)
        try:
            return response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return json.dumps(response, ensure_ascii=False)

    def chat_completion_with_history(
        self,
        model: str,
        system_prompt: str,
        conversation_history: list[dict[str, str]],
        user_message: str,
        context_prompt: str = "",
    ) -> str:
        messages = [{"role": "system", "content": system_prompt}]
        if context_prompt.strip():
            messages.append({"role": "system", "content": context_prompt})
        for item in conversation_history:
            role = item.get("role", "")
            content = item.get("content", "")
            if role not in {"user", "assistant"} or not content.strip():
                continue
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": model,
            "messages": messages,
        }
        request = urllib.request.Request(
            url=f"{self.base_url}/v1/chat/completions",
            headers=self._headers(),
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
        )
        response = self._send(request)
        try:
            return response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return json.dumps(response, ensure_ascii=False)

    def create_embedding(self, model: str, text: str) -> dict:
        payload = {
            "model": model,
            "input": text,
        }
        request = urllib.request.Request(
            url=f"{self.base_url}/v1/embeddings",
            headers=self._headers(),
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
        )
        return self._send(request)

    def generate_image(self, model: str, prompt: str) -> str:
        prompt = (prompt or "").strip()
        attempts = [
            {"timeout": max(self.image_timeout, 420), "prompt": prompt, "size": "1024x1024"},
            {"timeout": max(self.image_timeout + 180, 720), "prompt": prompt[:900], "size": "1024x1024"},
        ]

        last_error = None
        for attempt in attempts:
            payload = {
                "model": model,
                "prompt": attempt["prompt"],
                "size": attempt["size"],
                "response_format": "b64_json",
            }
            request = urllib.request.Request(
                url=f"{self.base_url}/v1/images/generations",
                headers=self._headers(),
                data=json.dumps(payload).encode("utf-8"),
                method="POST",
            )
            response = self._send(request, timeout=attempt["timeout"])

            error = response.get("error") if isinstance(response, dict) else None
            if error:
                last_error = error
                continue

            for item in response.get("data", []):
                if item.get("url"):
                    return item["url"]
                if item.get("b64_json"):
                    return item["b64_json"]

        status = (last_error or {}).get("status")
        if status == "timeout":
            return (
                "Генерация изображения заняла слишком много времени на стороне модели. "
                "Попробуйте более короткий промпт, уточните стиль или повторите запрос ещё раз."
            )
        return "Не удалось получить изображение от модели. Попробуйте ещё раз."

    def transcribe_audio(self, model: str, file_path: str, prompt: str = "") -> str:
        path = Path(file_path).expanduser().resolve()
        boundary = "----MTSMVPBoundary7MA4YWxkTrZu0gW"
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        body = bytearray()

        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(b'Content-Disposition: form-data; name="model"\r\n\r\n')
        body.extend(model.encode("utf-8"))
        body.extend(b"\r\n")

        if prompt.strip():
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(b'Content-Disposition: form-data; name="prompt"\r\n\r\n')
            body.extend(prompt.encode("utf-8"))
            body.extend(b"\r\n")

        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'.encode("utf-8")
        )
        body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
        body.extend(path.read_bytes())
        body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        headers = self._headers().copy()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        request = urllib.request.Request(
            url=f"{self.base_url}/v1/audio/transcriptions",
            headers=headers,
            data=bytes(body),
            method="POST",
        )
        response = self._send(request)
        return response.get("text") or json.dumps(response, ensure_ascii=False)

    def _send(self, request: urllib.request.Request, timeout: int | None = None) -> dict:
        request_timeout = timeout or self.timeout
        try:
            ssl_context = None
            if not self.verify_ssl:
                ssl_context = ssl._create_unverified_context()

            with urllib.request.urlopen(request, timeout=request_timeout, context=ssl_context) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            return {
                "error": {
                    "status": error.code,
                    "body": body,
                }
            }
        except (TimeoutError, socket.timeout) as error:
            return {
                "error": {
                    "status": "timeout",
                    "body": str(error) or f"Request timed out after {request_timeout} seconds",
                }
            }
        except urllib.error.URLError as error:
            reason = getattr(error, "reason", error)
            if isinstance(reason, TimeoutError):
                return {
                    "error": {
                        "status": "timeout",
                        "body": str(reason) or f"Request timed out after {request_timeout} seconds",
                    }
                }
            return {
                "error": {
                    "status": "network_error",
                    "body": str(error),
                }
            }
        except ssl.SSLError as error:
            return {
                "error": {
                    "status": "ssl_error",
                    "body": str(error),
                }
            }
        except json.JSONDecodeError as error:
            return {
                "error": {
                    "status": "bad_response",
                    "body": str(error),
                }
            }
