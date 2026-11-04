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

import { Button, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BulkTaskAction } from '../../../../utils/myTaskBuckets';
import { BulkDecision } from './useBulkResolveTasks';

export interface MyTasksSelectionBarProps {
  selectedCount: number;
  action: BulkTaskAction;
  isResolving: boolean;
  onResolve: (decision: BulkDecision) => void;
  onClear: () => void;
  onOpenTasks: () => void;
}

/**
 * The actions for the selected rows, pinned to the bottom of the scrolling
 * body so they stay in reach however far down the selection was made. The
 * negative offsets cancel the body's padding.
 */
const MyTasksSelectionBar: React.FC<MyTasksSelectionBarProps> = ({
  selectedCount,
  action,
  isResolving,
  onResolve,
  onClear,
  onOpenTasks,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:sticky tw:-bottom-5 tw:-mx-5 tw:-mb-5 tw:mt-auto tw:flex tw:items-center tw:gap-2 tw:border-t tw:border-secondary tw:bg-surface tw:px-5 tw:py-3 tw:shadow-lg"
      data-testid="my-tasks-selection-bar">
      <Typography
        className="tw:mr-auto tw:text-text-primary!"
        data-testid="my-tasks-selected-count"
        size="text-sm"
        weight="medium">
        {t('label.n-selected', { count: selectedCount })}
      </Typography>
      {action.kind === 'resolve' ? (
        <>
          <Button
            color="secondary"
            data-testid="my-tasks-bulk-reject"
            isDisabled={isResolving}
            size="sm"
            onPress={() => onResolve('reject')}>
            {t(action.rejectLabelKey)}
          </Button>
          <Button
            color="primary"
            data-testid="my-tasks-bulk-approve"
            isLoading={isResolving}
            size="sm"
            onPress={() => onResolve('approve')}>
            {t(action.approveLabelKey)}
          </Button>
        </>
      ) : (
        <>
          <Button
            color="secondary"
            data-testid="my-tasks-clear-selection"
            size="sm"
            onPress={onClear}>
            {t('label.clear-selection')}
          </Button>
          <Button
            color="primary"
            data-testid="my-tasks-open-tasks"
            size="sm"
            onPress={onOpenTasks}>
            {t('label.open-task-plural')}
          </Button>
        </>
      )}
    </div>
  );
};

export default MyTasksSelectionBar;
