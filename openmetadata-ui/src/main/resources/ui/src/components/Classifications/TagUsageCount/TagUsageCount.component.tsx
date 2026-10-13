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

import { Skeleton, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityTabs } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { getClassificationTagPath } from '../../../utils/RouterUtils';

export interface TagUsageCountProps {
  record: Tag;
  // Undefined when unknown, so a missing bucket still reads as a real zero
  usageCounts?: Record<string, number>;
  isLoading?: boolean;
}

export const TagUsageCount = ({
  record,
  usageCounts,
  isLoading,
}: TagUsageCountProps) => {
  const { t } = useTranslation();
  const testId = `usage-count-${record.name}`;
  const tagFQN = record.fullyQualifiedName;

  if (isLoading) {
    return <Skeleton className="tw:mx-auto tw:w-8" />;
  }

  if (!usageCounts || !tagFQN) {
    return <Typography data-testid={testId}>{NO_DATA_PLACEHOLDER}</Typography>;
  }

  const count = usageCounts[tagFQN.toLowerCase()] ?? 0;

  if (count === 0) {
    return <Typography data-testid={testId}>{count}</Typography>;
  }

  return (
    <Link
      aria-label={`${count} ${t('label.asset-plural-lowercase')}`}
      data-testid={testId}
      to={getClassificationTagPath(tagFQN, EntityTabs.ASSETS)}>
      {count}
    </Link>
  );
};
