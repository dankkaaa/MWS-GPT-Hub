import React from "react";

function iconProps(className = "h-5 w-5") {
  return {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.85",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  };
}

function IconBase({ className, children }) {
  return <svg {...iconProps(className)}>{children}</svg>;
}

export function MenuIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M5 7H19" />
      <path d="M5 12H19" />
      <path d="M5 17H19" />
    </IconBase>
  );
}

export function PenSquareIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M3.75 20.25H8.35L18.05 10.55A2.12 2.12 0 0 0 18.05 7.55L16.45 5.95A2.12 2.12 0 0 0 13.45 5.95L3.75 15.65V20.25Z" />
      <path d="M12.75 6.65L17.35 11.25" />
    </IconBase>
  );
}

export function SettingsIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.5 12A1.15 1.15 0 0 0 20.22 13.05L20.36 13.1A1.95 1.95 0 1 1 18.98 16.46L18.84 16.41A1.15 1.15 0 0 0 17.53 16.85L17.45 16.98A1.15 1.15 0 0 0 17.32 18.24V18.4A1.95 1.95 0 1 1 13.42 18.4V18.24A1.15 1.15 0 0 0 12.72 17.2L12.58 17.15A1.15 1.15 0 0 0 11.27 17.59L11.16 17.71A1.95 1.95 0 1 1 8.4 14.95L8.51 14.84A1.15 1.15 0 0 0 8.95 13.53L8.9 13.39A1.15 1.15 0 0 0 7.86 12.69H7.7A1.95 1.95 0 1 1 7.7 8.79H7.86A1.15 1.15 0 0 0 8.9 8.09L8.95 7.95A1.15 1.15 0 0 0 8.51 6.64L8.4 6.53A1.95 1.95 0 1 1 11.16 3.77L11.27 3.88A1.15 1.15 0 0 0 12.58 4.32L12.72 4.27A1.15 1.15 0 0 0 13.42 3.23V3.07A1.95 1.95 0 1 1 17.32 3.07V3.23A1.15 1.15 0 0 0 18.02 4.27L18.16 4.32A1.15 1.15 0 0 0 19.47 3.88L19.58 3.77A1.95 1.95 0 1 1 22.34 6.53L22.23 6.64A1.15 1.15 0 0 0 21.79 7.95L21.84 8.09A1.15 1.15 0 0 0 22.88 8.79H23.04A1.95 1.95 0 1 1 23.04 12.69H22.88A1.15 1.15 0 0 0 21.84 13.39L21.79 13.53A1.15 1.15 0 0 0 22.23 14.84" />
    </IconBase>
  );
}

export function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </IconBase>
  );
}

export function ChevronDownIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M6.75 9.75L12 15L17.25 9.75" />
    </IconBase>
  );
}

export function ChevronUpIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M6.75 14.25L12 9L17.25 14.25" />
    </IconBase>
  );
}

export function ChevronRightIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M9.5 6.75L14.75 12L9.5 17.25" />
    </IconBase>
  );
}

export function MicrophoneIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M12 14.85A3.35 3.35 0 0 0 15.35 11.5V7.85A3.35 3.35 0 1 0 8.65 7.85V11.5A3.35 3.35 0 0 0 12 14.85Z" />
      <path d="M18 11.5A6 6 0 0 1 6 11.5" />
      <path d="M12 14.85V19.5" />
      <path d="M9.25 19.5H14.75" />
    </IconBase>
  );
}

export function SendIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M21 4.5L10 14" />
      <path d="M21 4.5L14.25 19.5L10 14L4.5 9.75L21 4.5Z" />
    </IconBase>
  );
}

export function GlobeIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12H20.5" />
      <path d="M12 3.5C14.25 5.8 15.5 8.85 15.5 12C15.5 15.15 14.25 18.2 12 20.5C9.75 18.2 8.5 15.15 8.5 12C8.5 8.85 9.75 5.8 12 3.5Z" />
    </IconBase>
  );
}

export function ImageIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <rect x="4.25" y="4.25" width="15.5" height="15.5" rx="3" />
      <circle cx="9" cy="9" r="1.25" />
      <path d="M6.9 15.8L10.7 11.95L13.5 14.75L16 12.25L17.2 13.45" />
    </IconBase>
  );
}

export function SparklesIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M12 4.25L13.8 8.2L17.75 10L13.8 11.8L12 15.75L10.2 11.8L6.25 10L10.2 8.2L12 4.25Z" />
      <path d="M18.25 4.75L18.8 6.15L20.2 6.7L18.8 7.25L18.25 8.65L17.7 7.25L16.3 6.7L17.7 6.15L18.25 4.75Z" />
    </IconBase>
  );
}

export function FileIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M8 3.75H13.65L18.25 8.35V18.25A2 2 0 0 1 16.25 20.25H8A2 2 0 0 1 6 18.25V5.75A2 2 0 0 1 8 3.75Z" />
      <path d="M13.5 4V8.5H18" />
    </IconBase>
  );
}

export function LinkIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M10.25 13.75L13.75 10.25" />
      <path d="M7.2 15.8L5.7 17.3A3 3 0 1 0 9.95 21.55L11.45 20.05" />
      <path d="M12.55 3.95L14.05 2.45A3 3 0 1 1 18.3 6.7L16.8 8.2" />
      <path d="M8.75 15.25L15.25 8.75" />
    </IconBase>
  );
}

export function CloseIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M6 6L18 18" />
      <path d="M18 6L6 18" />
    </IconBase>
  );
}

export function MoreHorizontalIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function PinIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M15.5 4.5L19.5 8.5" />
      <path d="M14.8 5.2L9.55 10.45" />
      <path d="M18.8 9.2L13.55 14.45" />
      <path d="M11.2 12.8L5 19" />
      <path d="M8.5 7.5L16.5 15.5" />
    </IconBase>
  );
}

export function TrashIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M4.75 7.25H19.25" />
      <path d="M9.25 3.75H14.75" />
      <path d="M8 7.25V18.25A1.5 1.5 0 0 0 9.5 19.75H14.5A1.5 1.5 0 0 0 16 18.25V7.25" />
      <path d="M10.25 10.5V16" />
      <path d="M13.75 10.5V16" />
    </IconBase>
  );
}

export function CheckIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M5 12.5L9.25 16.75L19 7" />
    </IconBase>
  );
}

export function MoonIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M18.25 14.2A6.75 6.75 0 0 1 9.8 5.75A7.7 7.7 0 1 0 18.25 14.2Z" />
    </IconBase>
  );
}

export function SunIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.75V5" />
      <path d="M12 19V21.25" />
      <path d="M21.25 12H19" />
      <path d="M5 12H2.75" />
      <path d="M18.55 5.45L16.95 7.05" />
      <path d="M7.05 16.95L5.45 18.55" />
      <path d="M18.55 18.55L16.95 16.95" />
      <path d="M7.05 7.05L5.45 5.45" />
    </IconBase>
  );
}

export function UserCircleIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="8.25" r="3.25" />
      <path d="M5.5 19.25C6.8 16.45 9.2 15 12 15C14.8 15 17.2 16.45 18.5 19.25" />
      <circle cx="12" cy="12" r="9" />
    </IconBase>
  );
}

export function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="6.75" />
      <path d="M16 16L20 20" />
    </IconBase>
  );
}

export function LogOutIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M10 4.75H7.25A2 2 0 0 0 5.25 6.75V17.25A2 2 0 0 0 7.25 19.25H10" />
      <path d="M14.5 16.25L18.75 12L14.5 7.75" />
      <path d="M18.5 12H9.75" />
    </IconBase>
  );
}

export function LogInIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M14 4.75H16.75A2 2 0 0 1 18.75 6.75V17.25A2 2 0 0 1 16.75 19.25H14" />
      <path d="M9.5 16.25L5.25 12L9.5 7.75" />
      <path d="M5.5 12H14.25" />
    </IconBase>
  );
}

export function CopyIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V7.25A2 2 0 0 0 13 5.25H7.25A2 2 0 0 0 5.25 7.25V13A2 2 0 0 0 7.25 15H9" />
    </IconBase>
  );
}

export function RefreshIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M19 8.5V4.75H15.25" />
      <path d="M5 15.5V19.25H8.75" />
      <path d="M18.15 10A6.75 6.75 0 0 0 6.5 7.5L5.5 8.5" />
      <path d="M5.85 14A6.75 6.75 0 0 0 17.5 16.5L18.5 15.5" />
    </IconBase>
  );
}

export function ArrowDownIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M12 5.5V18.5" />
      <path d="M6.75 13.25L12 18.5L17.25 13.25" />
    </IconBase>
  );
}

export function MailIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <rect x="3.75" y="5.25" width="16.5" height="13.5" rx="2.5" />
      <path d="M4.5 7L12 12.5L19.5 7" />
    </IconBase>
  );
}

export function LockIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <rect x="5.5" y="10.25" width="13" height="9" rx="2.5" />
      <path d="M8.5 10.25V7.75A3.5 3.5 0 0 1 12 4.25A3.5 3.5 0 0 1 15.5 7.75V10.25" />
    </IconBase>
  );
}

export function AtSignIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.25" />
      <path d="M15.25 12V14A2 2 0 1 0 19.25 14V12A7.25 7.25 0 1 0 12 19.25" />
    </IconBase>
  );
}

export function MonitorIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <rect x="4" y="4.5" width="16" height="11.5" rx="2.5" />
      <path d="M10 19.5H14" />
      <path d="M12 16V19.5" />
    </IconBase>
  );
}

export function CodeIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M8.25 8.5L4.75 12L8.25 15.5" />
      <path d="M15.75 8.5L19.25 12L15.75 15.5" />
      <path d="M13.25 5.75L10.75 18.25" />
    </IconBase>
  );
}

export function ExpandIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M8 4.75H4.75V8" />
      <path d="M16 4.75H19.25V8" />
      <path d="M8 19.25H4.75V16" />
      <path d="M16 19.25H19.25V16" />
      <path d="M9 9L4.75 4.75" />
      <path d="M15 9L19.25 4.75" />
      <path d="M9 15L4.75 19.25" />
      <path d="M15 15L19.25 19.25" />
    </IconBase>
  );
}

export function ShareIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <circle cx="18" cy="5" r="2.25" />
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="19" r="2.25" />
      <path d="M8 11L15.8 6.2" />
      <path d="M8 13L15.8 17.8" />
    </IconBase>
  );
}

export function DownloadIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M12 4.75V15.75" />
      <path d="M7.75 11.75L12 16L16.25 11.75" />
      <path d="M5 19.25H19" />
    </IconBase>
  );
}

export function EditIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M4 20H8.5L18.05 10.45A2.12 2.12 0 0 0 18.05 7.45L16.55 5.95A2.12 2.12 0 0 0 13.55 5.95L4 15.5V20Z" />
      <path d="M12.5 7L17 11.5" />
    </IconBase>
  );
}

export function FilterIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M4.75 6.75H19.25" />
      <path d="M7.75 12H16.25" />
      <path d="M10.75 17.25H13.25" />
    </IconBase>
  );
}


export function MessageSquareIcon({ className = "h-5 w-5" }) {
  return (
    <IconBase className={className}>
      <path d="M5.5 6.75A2.25 2.25 0 0 1 7.75 4.5H16.25A2.25 2.25 0 0 1 18.5 6.75V13.5A2.25 2.25 0 0 1 16.25 15.75H10.2L6.5 19V15.75H7.75A2.25 2.25 0 0 1 5.5 13.5V6.75Z" />
    </IconBase>
  );
}

export function DotsLoaderIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="18" cy="12" r="1.75" />
    </svg>
  );
}
