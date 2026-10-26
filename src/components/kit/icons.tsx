import type { ComponentProps } from "react";

import type { Attribute } from "@/domain/types";

type IconProps = ComponentProps<"svg">;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export const SwordIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 3.5 20.5 3.5 20.5 9.5 9 21 3 15Z" />
    <path d="M5 13 11 19M3 21l3-3" />
  </Icon>
);

export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5Z" />
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5Z" />
  </Icon>
);

export const FeatherIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 4C11 4 6 10 6 18l-2 2" />
    <path d="M20 4c0 8-5 13-12 14M9 13h6" />
  </Icon>
);

export const HallIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V9l3-2V4h2v2l3-2 3 2V4h2v3l3 2v11Z" />
    <path d="M10 20v-4a2 2 0 0 1 4 0v4" />
  </Icon>
);

export const BoardIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h12v18H6Z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Icon>
);

export const HelmIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 13a7 7 0 0 1 14 0v6H5Z" />
    <path d="M12 6v13M8 13h8" />
  </Icon>
);

export const ChestIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11h16v8H4Z" />
    <path d="M4 11a8 5 0 0 1 16 0" />
    <path d="M11 11v3h2v-3" />
  </Icon>
);

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 12.5 4 4 8-9" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinimizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 12h12" />
  </Icon>
);

export const MaximizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6h12v12H6Z" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const ATTRIBUTE_ICON: Record<Attribute, (p: IconProps) => React.JSX.Element> = {
  strength: SwordIcon,
  intellect: BookIcon,
  agility: FeatherIcon,
};

export function Coin({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden {...props}>
      <circle cx="10" cy="10" r="9" fill="#c9a24a" stroke="#8a6a24" strokeWidth="1.2" />
      <circle cx="10" cy="10" r="6" fill="none" stroke="#f0d68a" strokeWidth="1" opacity="0.8" />
      <path d="M10 6.5v7M8 8.5h4" stroke="#8a6a24" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
