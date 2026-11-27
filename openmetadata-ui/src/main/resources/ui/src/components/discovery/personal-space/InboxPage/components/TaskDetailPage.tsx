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
import { Box } from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback } from 'react';
import { MY_TASKS_QUERY_KEY } from '../../../../../hooks/useMyTasks';
import {
  INBOX_OPEN_TASK_COUNT_QUERY_KEY,
  TASK_LIST_QUERY_KEY,
  TASK_STATUS_COUNTS_QUERY_KEY,
} from '../../inbox.constants';
import TaskDetailPanel from './TaskDetailPanel';

export interface TaskDetailPageProps {
  taskId: string;
  onTaskChanged?: () => void;
}

/**
 * A task on its own page, full width: the detail panel fills the height, so
 * its activity scrolls and the comment composer stays pinned at the bottom.
 */
const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  taskId,
  onTaskChanged,
}) => {
  const queryClient = useQueryClient();

  // The task list is unmounted while this page shows, so mark every cached
  // list and count stale; each re-reads when it next mounts.
  const handleTaskChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [TASK_LIST_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [TASK_STATUS_COUNTS_QUERY_KEY] });
    queryClient.invalidateQueries({
      queryKey: INBOX_OPEN_TASK_COUNT_QUERY_KEY,
    });
    queryClient.invalidateQueries({ queryKey: MY_TASKS_QUERY_KEY });
    onTaskChanged?.();
  }, [queryClient, onTaskChanged]);

  return (
    <Box
      className="tw:h-full tw:min-h-0 tw:w-full tw:flex-1"
      data-testid="task-detail-page"
      direction="col">
      <TaskDetailPanel
        taskId={taskId}
        onCommentsChanged={handleTaskChanged}
        onResolved={handleTaskChanged}
        onTaskUpdated={handleTaskChanged}
      />
    </Box>
  );
};

export default TaskDetailPage;
