/*
 *  Copyright 2023 Collate.
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
import { upperFirst } from 'lodash';
import RichTextEditorPreviewerV1 from '../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { EntityStatsData } from '../components/Settings/Applications/AppLogsViewer/AppLogsViewer.interface';
import TagsViewer from '../components/Tag/TagsViewer/TagsViewer';
import {
  Status,
  StepStats,
} from '../generated/entity/applications/appRunRecord';

export const getStatusTypeForApplication = (status: Status) => {
  switch (status) {
    case Status.Failed:
      return StatusType.Failure;

    case Status.Success:
    case Status.Active:
    case Status.Completed:
      return StatusType.Success;

    case Status.Running:
      return StatusType.Running;

    case Status.Started:
      return StatusType.Started;

    case Status.Pending:
      return StatusType.Pending;

    case Status.ActiveError:
      return StatusType.ActiveError;

    default:
      return StatusType.Stopped;
  }
};
export const getEntityStatsData = (data: {
  [key: string]: StepStats;
}): EntityStatsData[] => {
  const filteredRow = ['failedRecords', 'totalRecords', 'successRecords'];

  const result = Object.entries(data).reduce<EntityStatsData[]>(
    (acc, [key, stats]) => {
      if (filteredRow.includes(key)) {
        return acc;
      }

      if (
        !stats ||
        typeof stats.totalRecords !== 'number' ||
        typeof stats.successRecords !== 'number' ||
        typeof stats.failedRecords !== 'number'
      ) {
        return acc;
      }

      return [
        ...acc,
        {
          name: upperFirst(key),
          totalRecords: stats.totalRecords,
          successRecords: stats.successRecords,
          failedRecords: stats.failedRecords,
        },
      ];
    },
    []
  );

  return result.sort((a: EntityStatsData, b: EntityStatsData) =>
    a.name.localeCompare(b.name)
  );
};

export const getWidgets = () => {
  return [RichTextEditorPreviewerV1, TagsViewer];
};
