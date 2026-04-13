DEFAULT_CHAT_MODEL = "mws-gpt-alpha"
STRONG_CHAT_MODEL = "qwen2.5-72b-instruct"
VISION_MODEL = "qwen2.5-vl"
ASR_MODEL = "whisper-turbo-local"
EMBEDDING_MODEL = "bge-m3"
IMAGE_GEN_MODEL = "qwen-image"


MODEL_REGISTRY = {
    "default_chat": DEFAULT_CHAT_MODEL,
    "strong_chat": STRONG_CHAT_MODEL,
    "vision": VISION_MODEL,
    "asr": ASR_MODEL,
    "embedding": EMBEDDING_MODEL,
    "image_generation": IMAGE_GEN_MODEL,
}
