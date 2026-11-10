"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeStyle = "professional" | "modern";

interface ThemeStyleContextType {
  themeStyle: ThemeStyle;
  setThemeStyle: (style: ThemeStyle) => void;
}

const ThemeStyleContext = createContext<ThemeStyleContextType>({
  themeStyle: "professional",
  setThemeStyle: () => null,
});

export function ThemeStyleProvider({ children }: { children: React.ReactNode }) {
  const [themeStyle] = useState<ThemeStyle>("professional");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-style", "professional");
    localStorage.removeItem("app-theme-style");
  }, []);

  return (
    <ThemeStyleContext.Provider
      value={{
        themeStyle,
        setThemeStyle: () => {},
      }}
    >
      {children}
    </ThemeStyleContext.Provider>
  );
}

export function useThemeStyle() {
  return useContext(ThemeStyleContext);
}
