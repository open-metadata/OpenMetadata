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

import { Box, Button } from '@openmetadata/ui-core-components';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskComment } from '../../../generated/entity/tasks/task';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../utils/FeedUtilsPure';
import ActivityFeedEditorNew from '../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';

export interface TaskCommentBodyProps {
  comment: TaskComment;
  isEditing: boolean;
  onCancelEdit: () => void;
  onSave: (message: string) => Promise<void>;
  /**
   * The comment as it reads when not being edited. Supplied by the consumer
   * because the activity-feed card and the Inbox panel present a comment very
   * differently - only the edit affordance is shared, not the surrounding layout.
   */
  children: ReactNode;
}

/** A comment's inline editor while editing, otherwise the consumer's own view. */
const TaskCommentBody: FC<TaskCommentBodyProps> = ({
  comment,
  isEditing,
  onCancelEdit,
  onSave,
  children,
}) => {
  const { t } = useTranslation();

  if (!isEditing) {
    return <>{children}</>;
  }

  return (
    <Box data-testid="edit-task-comment-editor" direction="col" gap={2}>
      <ActivityFeedEditorNew
        focused
        defaultValue={MarkdownToHTMLConverter.makeHtml(
          getFrontEndFormat(comment.message)
        )}
        onSave={onSave}
      />
      <Box align="center" className="tw:justify-end">
        <Button
          color="link-gray"
          data-testid="cancel-edit-task-comment"
          size="sm"
          onPress={onCancelEdit}>
          {t('label.cancel')}
        </Button>
      </Box>
    </Box>
  );
};

export default TaskCommentBody;
