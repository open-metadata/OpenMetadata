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

import {
  Box,
  FilterSelect,
  Input,
  SearchInputIcon,
} from '@openmetadata/ui-core-components';
import { FilterFunnel01, FilterLines } from '@untitledui/icons';
import React, { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, TaskType } from '../../../../../generated/entity/tasks/task';
import { getTaskTypeBadge } from '../taskDetail.utils';

/** How the loaded tasks are broken up in the list. */
export type InboxTaskGrouping = 'none' | 'type';

export interface InboxTaskListToolbarProps {
  /** The All / Open / Closed control, sharing the first row with grouping. */
  statusFilter: ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  grouping: InboxTaskGrouping;
  onGroupingChange: (value: InboxTaskGrouping) => void;
  typeFilter: TaskType[];
  onTypeFilterChange: (value: TaskType[]) => void;
  /** The loaded tasks, whose types are the only ones worth offering. */
  tasks: Task[];
}

/**
 * The list column's controls: status and grouping on one row, search and the
 * type filter on the next.
 *
 * The type options come from the tasks on screen rather than the full enum, so
 * the filter never offers a type the queue does not contain.
 */
const InboxTaskListToolbar: React.FC<InboxTaskListToolbarProps> = ({
  statusFilter,
  search,
  onSearchChange,
  grouping,
  onGroupingChange,
  typeFilter,
  onTypeFilterChange,
  tasks,
}) => {
  const { t } = useTranslation();

  // The trigger shows the chosen option's `textValue` ("Group: Type"); the menu
  // rows show the bare option.
  const groupingOptions = useMemo(
    () =>
      [
        { value: 'type', label: t('label.type') },
        { value: 'none', label: t('label.none') },
      ].map((option) => ({
        ...option,
        textValue: t('label.group-with-value', { value: option.label }),
      })),
    [t]
  );

  const typeOptions = useMemo(() => {
    const counts = new Map<TaskType, number>();
    tasks.forEach((task) =>
      counts.set(task.type, (counts.get(task.type) ?? 0) + 1)
    );

    return Array.from(counts, ([type, count]) => ({
      value: type,
      label: getTaskTypeBadge({ type } as Task, t).label,
      count,
    }));
  }, [tasks, t]);

  return (
    <Box
      className="tw:shrink-0 tw:gap-3 tw:px-4 tw:pt-4 tw:pb-3"
      data-testid="inbox-tasks-toolbar"
      direction="col">
      <Box align="center" className="tw:justify-between tw:gap-2">
        {statusFilter}
        {/* A grouping always has a value, so FilterSelect's "active filter"
            brand tint would be permanent; keep the trigger neutral. */}
        <FilterSelect
          className="tw:**:text-tertiary tw:hover:**:text-secondary"
          data-testid="inbox-tasks-group-by"
          label={t('label.group')}
          options={groupingOptions}
          selectedValues={[grouping]}
          selectionMode="single"
          triggerIcon={FilterLines}
          triggerVariant="button"
          typography="regular"
          onChange={([value]) =>
            onGroupingChange((value as InboxTaskGrouping) ?? 'none')
          }
        />
      </Box>
      <Box align="center" className="tw:gap-2">
        <Input
          className="tw:min-w-0 tw:flex-1"
          icon={SearchInputIcon}
          inputDataTestId="inbox-tasks-search"
          placeholder={t('label.search-this-queue')}
          size="sm"
          value={search}
          onChange={onSearchChange}
        />
        <FilterSelect
          bordered
          data-testid="inbox-tasks-type-filter"
          label={t('label.filter')}
          options={typeOptions}
          selectedValues={typeFilter}
          selectionMode="multiple"
          triggerIcon={FilterFunnel01}
          triggerVariant="button"
          onChange={(values) => onTypeFilterChange(values as TaskType[])}
        />
      </Box>
    </Box>
  );
};

export default InboxTaskListToolbar;
