"use client";

import { useFormStatus } from "react-dom";
import { buttonStyles } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Salvando...",
  variant = "primary",
  confirmMessage,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonStyles;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonStyles[variant]}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
