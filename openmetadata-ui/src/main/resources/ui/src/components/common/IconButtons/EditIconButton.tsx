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
import { Button, ButtonProps } from 'antd';
import { Tooltip } from '../AntdCompat';;
import classNames from 'classnames';
import { ReactComponent as CommentIcon } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as CardExpandCollapseIcon } from '../../../assets/svg/ic-card-expand-collapse.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ExpandIcon } from '../../../assets/svg/ic-expand-right.svg';
import { ReactComponent as RequestIcon } from '../../../assets/svg/request-icon.svg';

type IconButtonPropsInternal = ButtonProps & {
  newLook?: boolean;
};

export const EditIconButton = ({
  title,
  className,
  size,
  newLook,
  ...props
}: IconButtonPropsInternal) => {
  return (
    <Tooltip title={title}>
      {newLook ? (
        <Button
          className={classNames('bordered', className)}
          icon={<EditIcon />}
          size={size}
          {...props}
        />
      ) : (
        <Button
          className={className}
          icon={<EditIcon className="table-action-icon" />}
          size="small"
          type="text"
          {...props}
        />
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
}: IconButtonPropsInternal) => {
  return (
    <Tooltip title={title}>
      {newLook ? (
        <Button
          className={classNames('bordered', className)}
          icon={<RequestIcon />}
          size={size}
          {...props}
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
}: IconButtonPropsInternal) => {
  return (
    <Tooltip title={title}>
      {newLook ? (
        <Button
          className={classNames('bordered', className)}
          icon={<CommentIcon />}
          size={size}
          {...props}
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
  ...props
}: IconButtonPropsInternal) => {
  const button = (
    <Button
      className={classNames('bordered', className)}
      disabled={disabled}
      icon={<CardExpandCollapseIcon />}
      tabIndex={0}
      type="text"
      {...props}
    />
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
}: IconButtonPropsInternal) => {
  return (
    <Tooltip title={title}>
      <Button
        className={classNames('bordered', className)}
        icon={<PlusOutlined />}
        size={size}
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
