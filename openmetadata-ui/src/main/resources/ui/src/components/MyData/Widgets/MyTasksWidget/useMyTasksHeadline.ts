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

import { useTranslation } from 'react-i18next';
import type { TopicStatus } from '../Common/TopicWidget/topics.types';

/**
 * The card's header: the open total, then — when there are any — the incidents
 * that need a resolution first, which also earn the red status chip.
 */
export const useMyTasksHeadline = (
  total: number,
  incidentCount: number
): { summary: string; status?: TopicStatus } => {
  const { t } = useTranslation();
  const openSummary = t('message.count-open-tasks-assigned-to-you', {
    count: total,
  });

  if (incidentCount === 0) {
    return { summary: openSummary };
  }

  return {
    status: {
      color: 'error',
      label: t('message.count-incident', { count: incidentCount }),
    },
    summary: `${openSummary} ${t('message.count-incidents-need-resolution', {
      count: incidentCount,
    })}`,
  };
};
