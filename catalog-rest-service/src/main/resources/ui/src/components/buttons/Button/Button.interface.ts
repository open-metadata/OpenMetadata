import React, { ReactNode } from 'react';

export interface Props {
  block?: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  size: 'large' | 'regular' | 'small' | 'x-small' | 'custom';
  theme?: 'default' | 'primary';
  variant: 'contained' | 'outlined' | 'link' | 'text';
}

export interface ButtonAsButtonProps
  extends Props,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The element that should be rendered as a button
   */
  tag?: 'button';
  /**
   * The native HTML button type
   */
  type?: 'button' | 'submit' | 'reset';
}

export interface ButtonAsAnchorProps
  extends Props,
    React.AnchorHTMLAttributes<HTMLAnchorElement> {
  tag: 'a';
}

export interface ButtonAsOtherProps
  extends Props,
    React.AnchorHTMLAttributes<HTMLAnchorElement> {
  tag: string;
}

export type ButtonProps =
  | ButtonAsButtonProps
  | ButtonAsAnchorProps
  | ButtonAsOtherProps;

export type Ref = ReactNode | HTMLElement | string;
