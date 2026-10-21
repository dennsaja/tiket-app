"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = React.useState(true);
  React.useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const label = dark ? "Ganti ke mode terang" : "Ganti ke mode gelap";
  return <button type="button" className="header-icon" aria-label={label} title={label} onClick={() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("helpdesk-theme", next ? "dark" : "light"); } catch {}
  }}>{dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}</button>;
}
