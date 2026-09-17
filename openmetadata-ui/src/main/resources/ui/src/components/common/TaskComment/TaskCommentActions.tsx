/*
 *  Copyright 2026 Collate.
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
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

export interface TaskCommentActionsProps {
  canDelete: boolean;
  canEdit: boolean;
  className?: string;
  onDeleteRequest: () => void;
  onEditRequest: () => void;
}

/**
 * Edit / delete affordances for a task comment.
 *
 * Real buttons rather than clickable SVGs: each is reachable by Tab, carries an
 * accessible name from its tooltip, and activates on Enter/Space. Consumers that
 * want these revealed on hover should do that with CSS (opacity) on a `tw:group`
 * ancestor - unmounting them until hover puts them permanently out of reach of
 * the keyboard, which is the bug this pattern exists to avoid.
 */
const TaskCommentActions: FC<TaskCommentActionsProps> = ({
  canDelete,
  canEdit,
  className,
  onDeleteRequest,
  onEditRequest,
}) => {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t('label.action-plural')}
      className={className}
      data-testid="task-comment-actions"
      role="group">
      {canEdit && (
        <ButtonUtility
          color="tertiary"
          data-testid="edit-task-comment"
          icon={EditIcon}
          size="xs"
          tooltip={t('label.edit')}
          onClick={onEditRequest}
        />
      )}
      {canDelete && (
        <ButtonUtility
          color="tertiary"
          data-testid="delete-task-comment"
          icon={DeleteIcon}
          size="xs"
          tooltip={t('label.delete')}
          onClick={onDeleteRequest}
        />
      )}
    </div>
  );
};

export default TaskCommentActions;
