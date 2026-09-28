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
import {
  Button,
  ButtonProps,
  ButtonUtility,
} from '@openmetadata/ui-core-components';
import { Tooltip } from 'antd';
import classNames from 'classnames';
import { forwardRef, ReactNode, Ref } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as CardExpandCollapseIcon } from '../../../assets/svg/ic-card-expand-collapse.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ExpandIcon } from '../../../assets/svg/ic-expand-right.svg';

export type IconButtonProps = Omit<ButtonProps, 'size' | 'color'> & {
  newLook?: boolean;
  /** antd-style size kept so existing callers stay unchanged. */
  size?: 'small' | 'middle' | 'large';
  icon?: ReactNode;
};

// `.bordered` icon-only boxes from the retired antd look: 20px (small) / 30px.
const getBorderedClassName = (size: IconButtonProps['size']) =>
  size === 'small'
    ? 'tw:size-5 tw:p-0! tw:rounded-md tw:before:rounded-md tw:[&_svg]:size-3'
    : 'tw:size-[30px] tw:p-0! tw:[&_svg]:size-4';

const withDisabledTooltip = (
  title: IconButtonProps['title'],
  disabled: boolean | undefined,
  button: ReactNode
) => (
  <Tooltip title={title}>
    {/* antd Tooltip only auto-wraps a disabled antd Button; a disabled core
        Button needs a span so the tooltip still shows. */}
    {disabled ? <span className="tw:inline-flex">{button}</span> : button}
  </Tooltip>
);

// Forwards its ref so react-aria's Pressable can make it a PopoverTrigger child.
export const EditIconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ title, className, size, newLook, icon, disabled, ...props }, ref) =>
    withDisabledTooltip(
      title,
      disabled,
      <Button
        aria-label={title}
        className={classNames(
          newLook && ['bordered', getBorderedClassName(size)],
          className
        )}
        color={newLook ? 'secondary' : 'tertiary'}
        iconLeading={icon ?? EditIcon}
        isDisabled={disabled}
        ref={ref as Ref<HTMLButtonElement | HTMLAnchorElement>}
        size="sm"
        {...props}
      />
    )
);

interface AlignRightIconButtonProps {
  title: string;
  className?: string;
  onClick?: () => void;
}

export const AlignRightIconButton = ({
  title,
  className,
  onClick,
}: AlignRightIconButtonProps) => (
  <ButtonUtility
    className={className}
    color="tertiary"
    data-testid="tab-expand-button"
    icon={ExpandIcon}
    tooltip={title}
    onClick={onClick}
  />
);

export const CardExpandCollapseIconButton = ({
  title,
  className,
  disabled,
  size,
  icon,
  newLook: _newLook,
  ...props
}: IconButtonProps) =>
  withDisabledTooltip(
    title,
    disabled,
    <Button
      aria-label={title}
      className={classNames('bordered', getBorderedClassName(size), className)}
      color="secondary"
      iconLeading={icon ?? CardExpandCollapseIcon}
      isDisabled={disabled}
      size="sm"
      {...props}
    />
  );

export const DeleteIconButton = ({
  title,
  className,
  size,
  disabled,
  icon,
  newLook: _newLook,
  ...props
}: IconButtonProps) =>
  withDisabledTooltip(
    title,
    disabled,
    <Button
      aria-label={title}
      className={classNames('bordered', getBorderedClassName(size), className)}
      color="secondary"
      iconLeading={icon ?? IconDelete}
      isDisabled={disabled}
      size="sm"
      {...props}
    />
  );
