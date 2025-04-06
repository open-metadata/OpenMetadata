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
import Icon from '@ant-design/icons';
import { Button, ButtonProps, Tooltip } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { ReactComponent as CommentIcon } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as ExpandIcon } from '../../../assets/svg/ic-expand-right.svg';
import { ReactComponent as RequestIcon } from '../../../assets/svg/request-icon.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';

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
          icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
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
          component={RequestIcon}
          style={{ color: DE_ACTIVE_COLOR }}
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
          component={CommentIcon}
          style={{ color: DE_ACTIVE_COLOR }}
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
        icon={<ExpandIcon />}
        size={size}
        type="text"
        {...props}
      />
    </Tooltip>
  );
};
