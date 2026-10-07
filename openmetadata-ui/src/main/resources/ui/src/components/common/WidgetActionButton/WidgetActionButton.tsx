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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/action-icons/edit.svg';
import { ReactComponent as ListConversationIcon } from '../../../assets/svg/action-icons/list-conversation.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/action-icons/plus.svg';
import { ReactComponent as RequestUpdateIcon } from '../../../assets/svg/action-icons/request-update.svg';
import { WidgetActionButtonProps } from './WidgetActionButton.interface';

// ButtonUtility's own tooltip names the button and anchors on it; a
// TooltipTrigger around it nested a second, unnamed button with no focus ring.
//
// Disabled is sent as aria-disabled: the button stays the one tab stop and
// keeps its tooltip, which often says why it is disabled. ButtonUtility's
// isDisabled turns that tooltip off too, and a bare `disabled` made Tooltip
// wrap the still-enabled button in a second tab stop.
const createWidgetButton = (icon: ReactNode) => {
  const WidgetButton = ({
    title,
    disabled,
    onClick,
    ...props
  }: WidgetActionButtonProps) => (
    <ButtonUtility
      aria-disabled={disabled || undefined}
      className="tw:p-1 tw:aria-disabled:cursor-not-allowed tw:aria-disabled:text-fg-disabled_subtle"
      color="tertiary"
      icon={icon}
      size="xs"
      tooltip={title}
      onClick={disabled ? undefined : onClick}
      {...props}
    />
  );

  return WidgetButton;
};

export const WidgetEditButton = createWidgetButton(
  <EditIcon height={16} width={16} />
);

export const WidgetPlusButton = createWidgetButton(
  <PlusIcon height={15} width={15} />
);

export const WidgetCommentButton = createWidgetButton(
  <ListConversationIcon height={16} width={16} />
);

export const WidgetRequestButton = createWidgetButton(
  <RequestUpdateIcon height={16} width={16} />
);
