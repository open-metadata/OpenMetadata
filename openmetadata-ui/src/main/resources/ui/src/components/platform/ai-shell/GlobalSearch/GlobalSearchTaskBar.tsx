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
  Button,
  Divider,
  FilterSelect,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { TaskStatus, TaskType } from '../../../../generated/entity/tasks/task';
import {
  getTaskTypeLabelKey,
  toStatusLabelKey,
} from '../../../discovery/personal-space/InboxPage/taskLabel.utils';
import {
  TASK_STATUS_OPTIONS,
  TASK_TYPE_OPTIONS,
} from './GlobalSearch.constants';

export interface GlobalSearchTaskBarProps {
  isVisible: boolean;
  status?: TaskStatus;
  type?: TaskType;
  onStatusChange: (status?: TaskStatus) => void;
  onTypeChange: (type?: TaskType) => void;
}

const GlobalSearchTaskBar = ({
  isVisible,
  status,
  type,
  onStatusChange,
  onTypeChange,
}: GlobalSearchTaskBarProps) => {
  const { t } = useTranslation();

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <Divider />
      <Box align="center" className="tw:px-4 tw:py-2" gap={2}>
        <FilterSelect
          data-testid="global-search-task-status"
          label={t('label.status')}
          options={TASK_STATUS_OPTIONS.map((value) => ({
            value,
            label: t(toStatusLabelKey(value)),
          }))}
          selectedValues={status ? [status] : []}
          selectionMode="single"
          size="sm"
          triggerVariant="chip"
          onChange={(values) =>
            onStatusChange(values[0] as TaskStatus | undefined)
          }
        />
        <FilterSelect
          data-testid="global-search-task-type"
          label={t('label.type')}
          options={TASK_TYPE_OPTIONS.map((value) => ({
            value,
            label: t(getTaskTypeLabelKey(value)),
          }))}
          selectedValues={type ? [type] : []}
          selectionMode="single"
          size="sm"
          triggerVariant="chip"
          onChange={(values) => onTypeChange(values[0] as TaskType | undefined)}
        />
        {status || type ? (
          <Button
            color="link-gray"
            size="sm"
            onClick={() => {
              onStatusChange(undefined);
              onTypeChange(undefined);
            }}>
            {t('label.clear-filter-plural')}
          </Button>
        ) : null}
      </Box>
    </>
  );
};

export default GlobalSearchTaskBar;
