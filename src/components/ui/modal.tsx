"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ModalRoot = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalClose = DialogPrimitive.Close;

const ModalPortal = ({
  children,
  ...props
}: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props}>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {children}
    </div>
  </DialogPrimitive.Portal>
);

const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-xs",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(({ className, children, size = "md", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        "w-[calc(100%-2rem)] rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-black",
        "focus:outline-none",
        "data-[state=open]:animate-fade-in",
        {
          "max-w-sm": size === "sm",
          "max-w-md": size === "md",
          "max-w-lg": size === "lg",
          "max-w-2xl": size === "xl",
          "max-w-[95vw] max-h-[90vh]": size === "full",
        },
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ModalContent.displayName = DialogPrimitive.Content.displayName;

function ModalHeader({
  className,
  title,
  description,
  onClose,
}: {
  className?: string;
  title: string;
  description?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800",
        className
      )}
    >
      <div>
        <DialogPrimitive.Title className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      {onClose ? (
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <DialogPrimitive.Close className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors dark:hover:bg-zinc-900 dark:hover:text-zinc-300">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function ModalBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5 max-h-[75vh] overflow-y-auto", className)} {...props}>
      {children}
    </div>
  );
}

function ModalFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3.5 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50 rounded-b-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  return (
    <ModalRoot open={open} onOpenChange={onOpenChange}>
      <ModalContent size={size}>
        <ModalHeader
          title={title}
          description={description}
          onClose={() => onOpenChange(false)}
        />
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </ModalRoot>
  );
}

export {
  Modal,
  ModalRoot,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalClose,
  ModalOverlay,
};
