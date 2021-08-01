import React, { ReactNode } from 'react';

export type Position = 'top' | 'left' | 'bottom' | 'right';
export type Trigger = 'mouseenter' | 'focus' | 'click' | 'manual';
export type Theme = 'dark' | 'light' | 'transparent';
export type Size = 'small' | 'regular' | 'big';

export type PopOverProp = {
  html?: React.ReactElement;
  title?: string;
  arrow?: boolean;
  theme?: Theme;
  size?: Size;
  position: Position;
  trigger: Trigger;
  children: ReactNode;
  className?: string;
};
