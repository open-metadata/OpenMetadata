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
import Icon, { PlusOutlined } from '@ant-design/icons';
import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Button, ButtonProps, Tooltip } from 'antd';
import classNames from 'classnames';
import type { FC } from 'react';
import { ReactComponent as CommentIcon } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as CardExpandCollapseIcon } from '../../../assets/svg/ic-card-expand-collapse.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ExpandIcon } from '../../../assets/svg/ic-expand-right.svg';
import { ReactComponent as RequestIcon } from '../../../assets/svg/request-icon.svg';

type IconButtonPropsInternal = ButtonProps & {
  newLook?: boolean;
  'data-testid'?: string;
};

const toUtilitySize = (size: ButtonProps['size']): 'xs' | 'sm' =>
  size === 'large' ? 'sm' : 'xs';

interface UtilityIconButtonProps {
  title?: React.ReactNode;
  className?: string;
  size?: ButtonProps['size'];
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  icon: FC<{ className?: string }>;
  tabIndex?: number;
  'data-testid'?: string;
}

const UtilityIconButton = ({
  title,
  className,
  size,
  disabled,
  onClick,
  icon,
  tabIndex,
  'data-testid': dataTestId,
}: UtilityIconButtonProps) => (
  <ButtonUtility
    className={classNames('bordered', className)}
    data-testid={dataTestId}
    icon={icon}
    isDisabled={disabled}
    size={toUtilitySize(size)}
    tabIndex={tabIndex}
    tooltip={typeof title === 'string' ? title : undefined}
    onClick={onClick}
  />
);

export const EditIconButton = ({
  title,
  className,
  size,
  newLook,
  disabled,
  onClick,
  'data-testid': dataTestId,
  ...props
}: IconButtonPropsInternal) => {
  if (newLook) {
    return (
      <UtilityIconButton
        className={className}
        data-testid={dataTestId}
        disabled={disabled}
        icon={EditIcon}
        size={size}
        title={title}
        onClick={onClick}
      />
    );
  }

  return (
    <Tooltip title={title}>
      <Button
        className={className}
        data-testid={dataTestId}
        disabled={disabled}
        icon={<EditIcon className="table-action-icon" />}
        size="small"
        type="text"
        onClick={onClick}
        {...props}
      />
    </Tooltip>
  );
};

export const RequestIconButton = ({
  title,
  className,
  newLook,
  size,
  disabled,
  onClick,
  'data-testid': dataTestId,
  ...props
}: IconButtonPropsInternal) => {
  if (newLook) {
    return (
      <UtilityIconButton
        className={className}
        data-testid={dataTestId}
        disabled={disabled}
        icon={RequestIcon}
        size={size}
        title={title}
        onClick={onClick}
      />
    );
  }

  return (
    <Tooltip title={title}>
      <Icon
        className={classNames('table-action-icon', className)}
        component={RequestIcon}
        {...props}
      />
    </Tooltip>
  );
};

export const CommentIconButton = ({
  title,
  className,
  newLook,
  size,
  disabled,
  onClick,
  'data-testid': dataTestId,
  ...props
}: IconButtonPropsInternal) => {
  if (newLook) {
    return (
      <UtilityIconButton
        className={className}
        data-testid={dataTestId}
        disabled={disabled}
        icon={CommentIcon}
        size={size}
        title={title}
        onClick={onClick}
      />
    );
  }

  return (
    <Tooltip title={title}>
      <Icon
        className={classNames('table-action-icon', className)}
        component={CommentIcon}
        {...props}
      />
    </Tooltip>
  );
};

export const AlignRightIconButton = ({
  title,
  className,
  size,
  ...props
}: IconButtonPropsInternal) => {
  return (
    <Tooltip title={title}>
      <Button
        className={classNames('border-none tab-expand-icon', className)}
        data-testid="tab-expand-button"
        icon={<ExpandIcon />}
        size={size}
        type="text"
        {...props}
      />
    </Tooltip>
  );
};

export const CardExpandCollapseIconButton = ({
  title,
  className,
  disabled,
  onClick,
  'data-testid': dataTestId,
}: IconButtonPropsInternal) => (
  <UtilityIconButton
    className={className}
    data-testid={dataTestId}
    disabled={disabled}
    icon={CardExpandCollapseIcon}
    size="small"
    tabIndex={0}
    title={title}
    onClick={onClick}
  />
);

export const PlusIconButton = ({
  title,
  className,
  size,
  disabled,
  onClick,
  ...props
}: IconButtonPropsInternal) => {
  return (
    <Tooltip title={title}>
      <Button
        className={classNames('bordered', className)}
        disabled={disabled}
        icon={<PlusOutlined />}
        size={size}
        onClick={onClick}
        {...props}
      />
    </Tooltip>
  );
};

export const DeleteIconButton = ({
  title,
  className,
  size,
  ...props
}: IconButtonPropsInternal) => {
  return (
    <Tooltip title={title}>
      <Button
        className={classNames('bordered', className)}
        icon={<IconDelete />}
        size={size}
        {...props}
      />
    </Tooltip>
  );
};
