"use client";

import { useCallback, useState } from "react";
import { MenuIcon, SunIcon, MoonIcon } from "@/components/icons";
import Image from "next/image";
import { useSidebar } from "@/components/sidebar-context";


export default function Topbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { toggle: toggleSidebar } = useSidebar();
  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  return (
      <header className="topbar" style={{ height: "var(--topbar-height)" }}>
        <div className="tb-left">
          <button
            className="icon-btn"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <MenuIcon size={18} />
          </button>
          <div className="tb-brand">
            <Image
              className="tb-shield tb-shield--light"
              src="/logo-shield-light.png"
              alt=""
              width={26}
              height={26}
            />
            <Image
              className="tb-shield tb-shield--dark"
              src="/logo-shield-dark.png"
              alt=""
              width={26}
              height={26}
            />
            <div className="tb-word">
              Oracle <span className="em">Keep</span>
            </div>
          </div>
        </div>

        <div className="tb-right">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
            title={theme === "dark" ? "Light the day" : "Dim the lanterns"}
          >
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </header>
  );
}

