"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "helpdesk-theme";

function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(THEME_KEY) as "light" | "dark") || "light";
}

function applyTheme(theme: "light" | "dark") {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [mounted, setMounted] = React.useState(false);

  // On mount, read from localStorage and apply
  React.useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  if (!mounted) {
    return (
      <button
        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200/80 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-900"
        aria-label="Toggle theme"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200/80 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      aria-label={theme === "light" ? "Ganti ke mode gelap" : "Ganti ke mode terang"}
      title={theme === "light" ? "Mode Gelap" : "Mode Terang"}
    >
      {theme === "light" ? (
        <Moon className="h-3.5 w-3.5" />
      ) : (
        <Sun className="h-3.5 w-3.5 text-zinc-100" />
      )}
    </button>
  );
}
