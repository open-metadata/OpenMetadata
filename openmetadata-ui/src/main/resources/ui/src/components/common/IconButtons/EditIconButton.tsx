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
  ButtonUtility,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import {
  ButtonHTMLAttributes,
  FC,
  forwardRef,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { ReactComponent as CommentIcon } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as CardExpandCollapseIcon } from '../../../assets/svg/ic-card-expand-collapse.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ExpandIcon } from '../../../assets/svg/ic-expand-right.svg';
import { ReactComponent as RequestIcon } from '../../../assets/svg/request-icon.svg';

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'color' | 'onClick' | 'children'
> & {
  newLook?: boolean;
  /** Legacy antd size names; `small` renders the compact 20px box. */
  size?: 'small' | 'middle' | 'large';
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

type BaseIconButtonProps = IconButtonProps & {
  defaultIcon: FC<{ className?: string }>;
  bordered?: boolean;
};

// The bordered look mirrors the antd `.ant-btn-icon-only.bordered` box (20px /
// 30px with a 12px / 16px glyph); the plain look the antd `type="text"` button.
const BaseIconButton = forwardRef<HTMLButtonElement, BaseIconButtonProps>(
  (
    {
      title,
      className,
      size,
      bordered,
      disabled,
      icon,
      defaultIcon: DefaultIcon,
      newLook: _newLook,
      ...props
    },
    ref
  ) => (
    <Tooltip isDisabled={!title} title={title}>
      <Button
        aria-label={title}
        className={classNames(
          'tw:p-0!',
          bordered
            ? {
                'tw:size-5 tw:[&_svg]:size-3': size === 'small',
                'tw:size-7.5 tw:[&_svg]:size-4': size !== 'small',
              }
            : 'tw:size-6 tw:[&_svg]:size-3.5',
          className
        )}
        color={bordered ? 'secondary' : 'tertiary'}
        iconLeading={icon ?? DefaultIcon}
        isDisabled={disabled}
        ref={ref}
        size="xxs"
        {...props}
      />
    </Tooltip>
  )
);

// Forwards its ref so react-aria's Pressable can make it a PopoverTrigger child.
export const EditIconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (props, ref) => (
    <BaseIconButton
      bordered={props.newLook}
      defaultIcon={EditIcon}
      ref={ref}
      {...props}
    />
  )
);

export const RequestIconButton = (props: IconButtonProps) => (
  <BaseIconButton
    bordered={props.newLook}
    defaultIcon={RequestIcon}
    {...props}
  />
);

export const CommentIconButton = (props: IconButtonProps) => (
  <BaseIconButton
    bordered={props.newLook}
    defaultIcon={CommentIcon}
    {...props}
  />
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

export const CardExpandCollapseIconButton = (props: IconButtonProps) => (
  <BaseIconButton bordered defaultIcon={CardExpandCollapseIcon} {...props} />
);

export const PlusIconButton = (props: IconButtonProps) => (
  <BaseIconButton bordered defaultIcon={Plus} {...props} />
);

export const DeleteIconButton = (props: IconButtonProps) => (
  <BaseIconButton bordered defaultIcon={IconDelete} {...props} />
);
