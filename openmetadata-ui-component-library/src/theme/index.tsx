import React, { createContext, useContext, ReactNode } from "react";

export interface Theme {
  button: React.CSSProperties;
}

const defaultTheme: Theme = {
  button: {
    backgroundColor: "#0052cc",
    color: "#fff",
    borderRadius: "4px",
    padding: "8px 16px",
    border: "none",
  },
};

const ThemeContext = createContext<Theme>(defaultTheme);

export const ThemeProvider: React.FC<{
  children: ReactNode;
  theme?: Theme;
}> = ({ children, theme }) => {
  return (
    <ThemeContext.Provider value={theme || defaultTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
