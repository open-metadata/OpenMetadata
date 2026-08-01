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
import type { ButtonProps } from 'antd';
import { Tooltip } from 'antd';
import { Button } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { ReactComponent as CommentIcon } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as CardExpandCollapseIcon } from '../../../assets/svg/ic-card-expand-collapse.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ExpandIcon } from '../../../assets/svg/ic-expand-right.svg';
import { ReactComponent as RequestIcon } from '../../../assets/svg/request-icon.svg';

export type IconButtonProps = ButtonProps & {
  newLook?: boolean;
};

// antd `size` (large | middle | small | undefined) -> core `size`.
// Approved 2026-07-30 mapping (docs/antd-migration/button.md).
const toCoreSize = (size?: ButtonProps['size']) => {
  if (size === 'small') {
    return 'xs';
  }
  if (size === 'large') {
    return 'md';
  }

  return 'sm';
};

export const EditIconButton = ({
  title,
  className,
  size,
  newLook,
  ...props
}: IconButtonProps) => {
  return (
    <Tooltip title={title}>
      {newLook ? (
        <Button
          className={classNames('bordered', className)}
          {...props}
          color="secondary"
          iconLeading={<EditIcon />}
          size={toCoreSize(size)}
        />
      ) : (
        <Button
          className={className}
          {...props}
          color='tertiary'
          size='xs'
          iconLeading={<EditIcon className="table-action-icon" />} />
      )}
    </Tooltip>
  );
};

export const RequestIconButton = ({
  title,
  className,
  newLook,
  size,
  ...props
}: IconButtonProps) => {
  return (
    <Tooltip title={title}>
      {newLook ? (
        <Button
          className={classNames('bordered', className)}
          {...props}
          color="secondary"
          iconLeading={<RequestIcon />}
          size={toCoreSize(size)}
        />
      ) : (
        <Icon
          className={classNames('table-action-icon', className)}
          component={RequestIcon}
          {...props}
        />
      )}
    </Tooltip>
  );
};

export const CommentIconButton = ({
  title,
  className,
  newLook,
  size,
  ...props
}: IconButtonProps) => {
  return (
    <Tooltip title={title}>
      {newLook ? (
        <Button
          className={classNames('bordered', className)}
          {...props}
          color="secondary"
          iconLeading={<CommentIcon />}
          size={toCoreSize(size)}
        />
      ) : (
        <Icon
          className={classNames('table-action-icon', className)}
          component={CommentIcon}
          {...props}
        />
      )}
    </Tooltip>
  );
};

export const AlignRightIconButton = ({
  title,
  className,
  size,
  ...props
}: IconButtonProps) => {
  return (
    <Tooltip title={title}>
      <Button
        className={classNames('border-none tab-expand-icon', className)}
        data-testid="tab-expand-button"
        {...props}
        color="tertiary"
        iconLeading={<ExpandIcon />}
        size={toCoreSize(size)}
      />
    </Tooltip>
  );
};

export const CardExpandCollapseIconButton = ({
  title,
  className,
  disabled,
  ...props
}: IconButtonProps) => {
  const button = (
    <Button
      className={classNames('bordered', className)}
      tabIndex={0}
      {...props}
      color='tertiary'
      isDisabled={disabled}
      iconLeading={<CardExpandCollapseIcon />} />
  );

  return (
    <Tooltip title={title}>
      {/* Adding span to fix the issue with className is not being applied for disabled button
        Refer this comment for more details https://github.com/ant-design/ant-design/issues/21404#issuecomment-586800984 */}
      {disabled ? <span className={className}>{button}</span> : button}
    </Tooltip>
  );
};

export const PlusIconButton = ({
  title,
  className,
  size,
  ...props
}: IconButtonProps) => {
  return (
    <Tooltip title={title}>
      <Button
        className={classNames('bordered', className)}
        {...props}
        color="secondary"
        iconLeading={<PlusOutlined />}
        size={toCoreSize(size)}
      />
    </Tooltip>
  );
};

export const DeleteIconButton = ({
  title,
  className,
  size,
  ...props
}: IconButtonProps) => {
  return (
    <Tooltip title={title}>
      <Button
        className={classNames('bordered', className)}
        {...props}
        color="secondary"
        iconLeading={<IconDelete />}
        size={toCoreSize(size)}
      />
    </Tooltip>
  );
};
