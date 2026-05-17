"use client";

import { createContext, useContext, useState, useRef, useEffect } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: true,
  toggle: () => {}
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const toggle = () => setCollapsed((c) => !c);

  useEffect(() => {
    if (collapsed) return;

    function handleClick(e: MouseEvent) {
      const sidebar = document.querySelector(".rail");
      if (sidebar && !sidebar.contains(e.target as Node)) {
        toggle();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [collapsed, toggle]);


  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}