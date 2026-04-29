export type Theme = 'light' | 'dark';

export interface BrandColors {
  primaryColor?: string;
  hoverColor?: string;
  selectedColor?: string;
  errorColor?: string;
  successColor?: string;
  warningColor?: string;
  infoColor?: string;
}

export interface ThemeContextType {
  theme: Theme;
  brandColors?: BrandColors;
  setTheme: (theme: Theme) => void;
}
