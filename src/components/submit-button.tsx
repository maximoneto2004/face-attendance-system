"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./ui";
import { Icon, Spinner, type IconName } from "./icons";

export function SubmitButton({
  children,
  pendingText = "Salvando...",
  variant = "primary",
  size = "md",
  icon,
  confirmMessage,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  confirmMessage?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? <Spinner /> : icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {pending ? pendingText : children}
    </button>
  );
}
