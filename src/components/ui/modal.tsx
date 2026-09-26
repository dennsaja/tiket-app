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
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]",
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
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        "w-full rounded-md border border-gray-200 bg-white shadow-xl",
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
        "flex items-start justify-between border-b border-gray-200 px-5 py-4",
        className
      )}
    >
      <div>
        <DialogPrimitive.Title className="text-sm font-semibold text-gray-900">
          {title}
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-0.5 text-xs text-gray-500">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      {onClose && (
        <DialogPrimitive.Close
          onClick={onClose}
          className="ml-4 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function ModalBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("px-5 py-4", className)}>{children}</div>
  );
}

function ModalFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

// Convenient high-level Modal component
interface HighLevelModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children?: React.ReactNode;
}

function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
}: HighLevelModalProps) {
  if (title) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <ModalContent size={size}>
          <ModalHeader
            title={title}
            description={description}
            onClose={() => onOpenChange?.(false)}
          />
          <ModalBody>{children}</ModalBody>
        </ModalContent>
      </DialogPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export {
  Modal,
  ModalRoot,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalOverlay,
  ModalPortal,
};
