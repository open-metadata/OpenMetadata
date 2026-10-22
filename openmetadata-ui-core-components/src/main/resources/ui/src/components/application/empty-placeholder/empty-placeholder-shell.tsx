/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import type { FC, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';
import { Box } from '@/components/base/box/box';
import type { GapValues } from '@/components/base/box/box';
import { Button } from '@/components/base/buttons/button';
import type { ButtonProps } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';

export type EmptyPlaceholderIcon = FC<{ className?: string }> | ReactNode;

/** Shared icon-container styling for both variants */
export const EMPTY_PLACEHOLDER_ICON_BOX =
  // A borderless tile: `bg-primary` + soft shadow lift it off light surfaces and make it a darker
  // well on dark `bg-surface` cards. The glyph defaults to the brand colour; icons passed as
  // elements with their own `text-*` class still override it.
  'tw:flex tw:size-16 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-primary tw:text-fg-brand-primary tw:shadow-empty-placeholder-icon tw:dark:shadow-xs tw:*:data-icon:size-7';

export interface EmptyPlaceholderAction extends Omit<ButtonProps, 'children'> {
  key: string;
  label: ReactNode;
}

export interface EmptyPlaceholderFeature {
  key: string;
  icon: EmptyPlaceholderIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Extra classes for the icon container (e.g. to override its size) */
  iconClassName?: string;
}

export interface EmptyPlaceholderShellProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Buttons rendered below the content */
  actions?: EmptyPlaceholderAction[];
  /** Replaces the generated action buttons entirely */
  footer?: ReactNode;
  /**
   * Maximum content width. The content fills the container up to this cap, so
   * copy uses the space it has without overflowing narrow hosts. The root is
   * absolutely positioned and fills its nearest positioned ancestor, so the
   * host container MUST set `position: relative`.
   */
  width?: number | string;
  /** Vertical gap between the content items */
  gap?: GapValues;
  className?: string;
  children?: ReactNode;
}

export const renderEmptyPlaceholderIcon = (
  icon: EmptyPlaceholderIcon,
  className?: string
) => {
  let node: ReactNode = null;
  if (isReactComponent(icon)) {
    const Icon = icon as FC<{ className?: string }>;
    node = <Icon data-icon className={className} />;
  } else if (isValidElement(icon)) {
    const element = icon as ReactElement<{
      className?: string;
      'data-icon'?: boolean;
    }>;
    node = cloneElement(element, {
      'data-icon': true,
      className: cx(element.props.className, className),
    });
  }

  return node;
};

export const renderEmptyPlaceholderActions = (
  actions?: EmptyPlaceholderAction[]
) => {
  let node: ReactNode = null;
  if (actions && actions.length > 0) {
    node = (
      <Box align="center" gap={3} justify="center" wrap="wrap">
        {actions.map(({ key, label, size = 'sm', ...buttonProps }) => (
          <Button key={key} size={size} {...buttonProps}>
            {label}
          </Button>
        ))}
      </Box>
    );
  }

  return node;
};

export const EmptyPlaceholderShell = (props: EmptyPlaceholderShellProps) => {
  const {
    actions,
    footer,
    width,
    gap = 5,
    className,
    children,
    style,
    ...otherProps
  } = props;

  return (
    <Box
      align="center"
      className={cx('tw:absolute tw:inset-0 tw:h-full tw:w-full', className)}
      data-testid="empty-placeholder"
      direction="col"
      justify="center"
      style={style}
      {...otherProps}>
      <Box
        align="center"
        className="tw:text-center"
        direction="col"
        gap={gap}
        style={
          width === undefined ? undefined : { width: '100%', maxWidth: width }
        }>
        {children}
        {footer ?? renderEmptyPlaceholderActions(actions)}
      </Box>
    </Box>
  );
};
