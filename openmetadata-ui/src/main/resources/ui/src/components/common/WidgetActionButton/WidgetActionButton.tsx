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
  ButtonUtility,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { AnnotationQuestion, Plus } from '@untitledui/icons';
import { ReactComponent as CommentIcon } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { WidgetActionButtonProps } from './WidgetActionButton.interface';

export const WidgetEditButton = ({
  title,
  onClick,
  ...props
}: WidgetActionButtonProps) => {
  return (
    <Tooltip title={title}>
      <TooltipTrigger>
        <ButtonUtility
          className="tw:p-1"
          color="tertiary"
          icon={<EditIcon height={15} width={15} />}
          size="xs"
          onClick={onClick}
          {...props}
        />
      </TooltipTrigger>
    </Tooltip>
  );
};

export const WidgetPlusButton = ({
  title,
  onClick,
  ...props
}: WidgetActionButtonProps) => {
  return (
    <Tooltip title={title}>
      <TooltipTrigger>
        <ButtonUtility
          className="tw:p-1"
          color="secondary"
          icon={<Plus size={13} />}
          size="xs"
          onClick={onClick}
          {...props}
        />
      </TooltipTrigger>
    </Tooltip>
  );
};

export const WidgetCommentButton = ({
  title,
  onClick,
  ...props
}: WidgetActionButtonProps) => {
  return (
    <Tooltip title={title}>
      <TooltipTrigger>
        <ButtonUtility
          className="tw:p-1"
          color="secondary"
          icon={<CommentIcon height={13} width={13} />}
          size="xs"
          onClick={onClick}
          {...props}
        />
      </TooltipTrigger>
    </Tooltip>
  );
};

export const WidgetRequestButton = ({
  title,
  onClick,
  ...props
}: WidgetActionButtonProps) => {
  return (
    <Tooltip title={title}>
      <TooltipTrigger>
        <ButtonUtility
          className="tw:p-1"
          color="secondary"
          icon={<AnnotationQuestion size={13} />}
          size="xs"
          onClick={onClick}
          {...props}
        />
      </TooltipTrigger>
    </Tooltip>
  );
};
