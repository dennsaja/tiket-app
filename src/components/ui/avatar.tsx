"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-green-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-cyan-500",
    "bg-emerald-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const avatarSizes = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-7 w-7 text-xs",
  lg: "h-8 w-8 text-xs",
  xl: "h-10 w-10 text-sm",
  "2xl": "h-12 w-12 text-base",
};

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof avatarSizes;
  className?: string;
  showTooltip?: boolean;
}

function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);

  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        avatarSizes[size],
        className
      )}
    >
      <AvatarPrimitive.Image
        src={src ?? undefined}
        alt={name}
        className="h-full w-full object-cover"
      />
      <AvatarPrimitive.Fallback
        className={cn(
          "flex h-full w-full items-center justify-center font-medium text-white",
          colorClass
        )}
      >
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

function AvatarGroup({
  users,
  size = "md",
  max = 3,
  className,
}: {
  users: Array<{ name: string; src?: string | null }>;
  size?: keyof typeof avatarSizes;
  max?: number;
  className?: string;
}) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className={cn("flex -space-x-1.5", className)}>
      {visible.map((user, i) => (
        <Avatar
          key={i}
          name={user.name}
          src={user.src}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-gray-200 text-gray-600 ring-2 ring-white font-medium",
            avatarSizes[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

export { Avatar, AvatarGroup, getInitials, getAvatarColor };
