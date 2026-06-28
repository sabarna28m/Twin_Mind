import { createContext, useContext, useState, type ReactNode } from 'react';

interface SidebarCtx {
  collapsed: boolean;
  toggleCollapsed: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarCtx>({
  collapsed: false,
  toggleCollapsed: () => {},
  drawerOpen: false,
  setDrawerOpen: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('tm_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(v => {
      const next = !v;
      try { localStorage.setItem('tm_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, drawerOpen, setDrawerOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
