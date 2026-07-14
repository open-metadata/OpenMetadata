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
import type { FC, HTMLAttributes, ReactNode, Ref } from 'react';
import { isValidElement } from 'react';
import { Box } from '@/components/base/box/box';
import type { GapValues } from '@/components/base/box/box';
import { Button } from '@/components/base/buttons/button';
import type { CommonProps as ButtonCommonProps } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';

export type EmptyPlaceholderIcon = FC<{ className?: string }> | ReactNode;

export interface EmptyPlaceholderAction extends ButtonCommonProps {
  key: string;
  label: ReactNode;
  onPress?: () => void;
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
  ref?: Ref<HTMLDivElement>;
  /** Buttons rendered below the content */
  actions?: EmptyPlaceholderAction[];
  /** Replaces the generated action buttons entirely */
  footer?: ReactNode;
  /** Container width. Full width when omitted. */
  width?: number | string;
  /** Vertical gap between the shell's direct children */
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
    node = icon;
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
    ref,
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
      className={cx('tw:w-full', className)}
      data-testid="empty-placeholder"
      direction="col"
      gap={gap}
      justify="center"
      ref={ref}
      style={{ width, ...style }}
      {...otherProps}>
      {children}
      {footer ?? renderEmptyPlaceholderActions(actions)}
    </Box>
  );
};
