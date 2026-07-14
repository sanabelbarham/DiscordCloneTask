import type { InputHTMLAttributes } from "react";

export default function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded bg-surface-rail px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-surface-modifier focus:ring-brand ${className}`}
      {...props}
    />
  );
}
