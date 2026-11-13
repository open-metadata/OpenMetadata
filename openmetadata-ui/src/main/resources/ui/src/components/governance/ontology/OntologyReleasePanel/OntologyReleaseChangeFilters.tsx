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
  ButtonGroup,
  ButtonGroupItem,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import {
  KIND_MESSAGES,
  type ChangeFilter,
  type ChangeKindCounts,
} from './OntologyReleaseChanges.utils';

const FILTERS: readonly ChangeFilter[] = ['all', 'added', 'changed', 'removed'];

interface OntologyReleaseChangeFiltersProps {
  counts: ChangeKindCounts;
  rowCounts: Record<ChangeFilter, number>;
  filter: ChangeFilter;
  search: string;
  onFilterChange: (filter: ChangeFilter) => void;
  onSearchChange: (search: string) => void;
}

const OntologyReleaseChangeFilters = ({
  counts,
  rowCounts,
  filter,
  search,
  onFilterChange,
  onSearchChange,
}: OntologyReleaseChangeFiltersProps) => {
  const { t } = useTranslation();
  const kinds = KIND_MESSAGES.filter(([kind]) => counts[kind] > 0).map(
    ([kind, message]) => t(message, { count: counts[kind] })
  );
  const totalText = t('message.ontology-change-total', {
    count: counts.total,
  });

  return (
    <Box data-testid="ontology-change-filters" direction="col" gap={4}>
      <Typography
        data-testid="ontology-change-counts"
        size="text-md"
        weight="semibold">
        {kinds.length ? `${totalText}: ${kinds.join(', ')}` : totalText}
      </Typography>
      <Box align="center" gap={3} wrap="wrap">
        <Input
          aria-label={t('label.search-entity', {
            entity: t('label.change-plural').toLocaleLowerCase(),
          })}
          className="tw:min-w-60 tw:flex-1"
          icon={Search}
          inputDataTestId="ontology-change-search"
          placeholder={t('label.search-entity', {
            entity: t('label.change-plural').toLocaleLowerCase(),
          })}
          size="sm"
          value={search}
          onChange={onSearchChange}
        />
        <ButtonGroup
          disallowEmptySelection
          aria-label={t('label.change-plural')}
          selectedKeys={[filter]}
          size="sm"
          onSelectionChange={(keys) => {
            const [next] = [...keys];
            if (next) {
              onFilterChange(next as ChangeFilter);
            }
          }}>
          {FILTERS.map((option) => (
            <ButtonGroupItem
              data-testid={`ontology-change-filter-${option}`}
              id={option}
              key={option}>
              {t(`label.${option}`)} · {rowCounts[option]}
            </ButtonGroupItem>
          ))}
        </ButtonGroup>
      </Box>
    </Box>
  );
};

export default OntologyReleaseChangeFilters;
