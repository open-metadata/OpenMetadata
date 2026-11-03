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
  const summary = [
    t('message.ontology-change-total', { count: counts.total }),
    ...KIND_MESSAGES.filter(([kind]) => counts[kind] > 0).map(
      ([kind, message]) => t(message, { count: counts[kind] })
    ),
  ].join(' · ');

  return (
    <Box data-testid="ontology-change-filters" direction="col" gap={2}>
      <Typography
        color="secondary"
        data-testid="ontology-change-counts"
        size="text-sm">
        {summary}
      </Typography>
      <Input
        aria-label={t('label.search-entity', {
          entity: t('label.change-plural'),
        })}
        icon={Search}
        inputDataTestId="ontology-change-search"
        placeholder={t('label.search-entity', {
          entity: t('label.change-plural'),
        })}
        size="sm"
        value={search}
        onChange={onSearchChange}
      />
      <Box
        aria-label={t('label.change-plural')}
        gap={1}
        role="group"
        wrap="wrap">
        {FILTERS.map((option) => (
          <Button
            aria-pressed={filter === option}
            color={filter === option ? 'primary' : 'secondary'}
            data-testid={`ontology-change-filter-${option}`}
            key={option}
            size="xs"
            onPress={() => onFilterChange(option)}>
            {t(`label.${option}`)} · {rowCounts[option]}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

export default OntologyReleaseChangeFilters;
