"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5, 10, 20, 0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`glass w-full ${sizeClasses[size]} rounded-2xl border border-[var(--border)] shadow-2xl animate-fade-in-up`}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="btn btn-ghost btn-icon text-[var(--text-muted)] hover:text-white">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
