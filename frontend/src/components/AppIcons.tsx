"use client";

import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function IconBase({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function RobotIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M9 9h6" />
      <path d="M8 14h8" />
      <circle cx="9" cy="11" r="1" />
      <circle cx="15" cy="11" r="1" />
      <path d="M8 17v2" />
      <path d="M16 17v2" />
    </IconBase>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h14.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" />
      <path d="m19 14 0.6 2.2 2.2.6-2.2.6L19 20l-.6-2.2-2.2-.6 2.2-.6L19 14Z" />
      <path d="m5 14 .6 2.2L8 17l-2.4.8L5 20l-.6-2.2L2 17l2.4-.8L5 14Z" />
    </IconBase>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 6 9 17l-5-5" />
    </IconBase>
  );
}

export function LoaderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    </IconBase>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </IconBase>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </IconBase>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7" />
      <path d="m4 7 4 4h8l4-4" />
      <path d="m9 11 1.5 2h3L15 11" />
    </IconBase>
  );
}

export function FireIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3c2.7 2.7 4 4.8 4 7.2 0 2.8-2.4 4.8-4 4.8s-4-2-4-4.8C8 7.8 9.3 5.7 12 3Z" />
      <path d="M8 13c-.8 1.6-1 2.8-1 4.3 0 3 2.5 5.2 5 5.2s5-2.2 5-5.2c0-1.5-.3-2.7-1-4.3" />
    </IconBase>
  );
}

export function PhoneOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 4h3l1.8 3.4-1.7 1.7a14.4 14.4 0 0 0 4.2 4.2l1.7-1.7L20 15v3a2 2 0 0 1-2 2c-7.7 0-14-6.3-14-14a2 2 0 0 1 2-2h3" />
      <path d="m2 2 20 20" />
    </IconBase>
  );
}

export function BadgeCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3l7 3v5c0 4.3-2.8 7.5-7 9-4.2-1.5-7-4.7-7-9V6l7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.8-3.9" />
    </IconBase>
  );
}

export function CircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
    </IconBase>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-5" />
    </IconBase>
  );
}
