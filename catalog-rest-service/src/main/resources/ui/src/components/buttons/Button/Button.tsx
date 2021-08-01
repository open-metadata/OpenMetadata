import React, { FunctionComponent } from 'react';
// import classnames from 'classnames';
import { ButtonProps, Ref } from './Button.interface';
import { button } from './Button.styles';

export const Button: FunctionComponent<ButtonProps> = React.forwardRef<
  Ref,
  ButtonProps
>(
  (
    {
      block = false,
      children,
      className = '',
      disabled = false,
      size,
      tag = 'button',
      theme = 'default',
      type = tag === 'button' ? 'button' : undefined,
      variant,
      ...other
    }: ButtonProps,
    ref
  ) => {
    const baseStyle = button.base;
    const blockStyle = button.block;
    const sizeStyles = button.size[size];
    const layoutStyles = button[variant][theme].base;
    const activeStyles = button[variant][theme].active;
    const disabledStyles = button[variant]['default'].disabled;
    const classes = [
      baseStyle,
      sizeStyles,
      layoutStyles,
      disabled ? disabledStyles : activeStyles,
      block ? blockStyle : '',
      className,
    ].join(' ');

    return React.createElement(
      tag,
      {
        className: classes,
        ref,
        disabled,
        type,
        ...other,
      },
      children
    );
  }
);

Button.displayName = 'Button';
