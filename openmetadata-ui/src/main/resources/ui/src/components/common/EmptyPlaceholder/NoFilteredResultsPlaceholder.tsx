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

import { EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { FilterFunnel01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { NoFilteredResultsPlaceholderProps } from './EmptyPlaceholder.interface';
import { resolveSingleAction } from './EmptyPlaceholder.utils';

/**
 * Prefilled empty state for an active filter set that matched nothing.
 * Renders a "Clear Filters" action when `onClearFilters` is provided; pass
 * `actions` to replace it entirely.
 *
 * The underlying `EmptyPlaceholder` is absolutely positioned, so the host
 * container must set `position: relative` for it to be visible.
 */
const NoFilteredResultsPlaceholder = ({
  icon,
  title,
  description,
  actions,
  onClearFilters,
  ...props
}: NoFilteredResultsPlaceholderProps) => {
  const { t } = useTranslation();

  return (
    <EmptyPlaceholder
      actions={resolveSingleAction(
        actions,
        onClearFilters,
        'clear-filters',
        t('label.clear-filter-plural')
      )}
      description={description ?? t('message.nothing-matches-current-filter')}
      icon={icon ?? <FilterFunnel01 className="tw:text-secondary" />}
      title={title ?? t('label.no-result-for-these-filter-plural')}
      variant="blank"
      {...props}
    />
  );
};

export default NoFilteredResultsPlaceholder;
