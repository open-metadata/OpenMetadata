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

import { TFunction } from 'i18next';
import {
  AuditLogActiveFilter,
  AuditLogFilterCategoryType,
  AuditLogListParams,
  TimeFilterValue,
} from '../types/auditLogs.interface';

export const getAuditLogCategoryLabel = (
  category: AuditLogFilterCategoryType,
  t: TFunction
): string => {
  switch (category) {
    case 'time':
      return t('label.time');
    case 'user':
      return t('label.user');
    case 'bot':
      return t('label.bot');
    case 'entityType':
      return t('label.entity-type');
    default:
      return '';
  }
};

export const buildParamsFromFilters = (
  filters: AuditLogActiveFilter[]
): Partial<AuditLogListParams> => {
  const params: Partial<AuditLogListParams> = {};

  filters.forEach((filter) => {
    switch (filter.category) {
      case 'time': {
        const timeValue = filter.value as TimeFilterValue;
        if (timeValue.startTs !== undefined && timeValue.endTs !== undefined) {
          params.startTs = timeValue.startTs;
          params.endTs = timeValue.endTs;
        }

        break;
      }
      case 'user':
        params.userName = filter.value.value;
        params.actorType = 'USER';

        break;
      case 'bot':
        params.userName = filter.value.value;
        params.actorType = 'BOT';

        break;
      case 'entityType':
        params.entityType = filter.value.value;

        break;
    }
  });

  return params;
};
