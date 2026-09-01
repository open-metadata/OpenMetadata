/*
 *  Copyright 2024 Collate.
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
  Alert,
  Box,
  Button,
  Checkbox,
  Input,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { Check, SearchLg, XClose } from '@untitledui/icons';
import type { FC, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import type { EntityReference } from '../../../generated/type/entityReference';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';

export interface RelatedMetricOption {
  label: string;
  value: string;
  reference: EntityReference;
}

interface RelatedMetricsFormProps {
  metricFqn: string;
  defaultValue?: string[];
  initialOptions?: RelatedMetricOption[];
  onSubmit: (option: RelatedMetricOption[]) => Promise<void>;
  onCancel: () => void;
  onSelectionChange?: (options: RelatedMetricOption[]) => void;
  showActions?: boolean;
}

export const RelatedMetricsForm: FC<RelatedMetricsFormProps> = ({
  defaultValue = [],
  initialOptions = [],
  onCancel,
  onSubmit,
  onSelectionChange,
  metricFqn,
  showActions = true,
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set(defaultValue));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(searchText.trim()),
      250
    );

    return () => window.clearTimeout(timeout);
  }, [searchText]);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['related-metric-options', debouncedSearch],
    queryFn: () =>
      searchQuery({
        query: debouncedSearch,
        pageNumber: 1,
        pageSize: 20,
        searchIndex: SearchIndex.METRIC,
        trackTotalHits: false,
      }),
  });

  const options = useMemo(() => {
    const byId = new Map(
      initialOptions.map((option) => [option.value, option] as const)
    );
    data?.hits.hits.forEach(({ _source }) => {
      const metric = _source as Metric;
      if (metric.fullyQualifiedName !== metricFqn) {
        byId.set(metric.id, {
          label: getEntityName(metric),
          value: metric.id,
          reference: {
            id: metric.id,
            name: metric.name,
            displayName: metric.displayName,
            fullyQualifiedName: metric.fullyQualifiedName,
            type: 'metric',
          },
        });
      }
    });

    return Array.from(byId.values());
  }, [data?.hits.hits, initialOptions, metricFqn]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(options.filter(({ value }) => selectedIds.has(value)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form data-testid="related-metric-form" onSubmit={handleSubmit}>
      <Box direction="col" gap={3}>
        {showActions && (
          <Box align="center" gap={2} justify="end">
            <Button
              aria-label={t('label.cancel')}
              color="secondary"
              data-testid="cancelRelatedMetrics"
              iconLeading={XClose}
              isDisabled={isSubmitting}
              onPress={onCancel}
            />
            <Button
              aria-label={t('label.save')}
              color="primary"
              data-testid="saveRelatedMetrics"
              iconLeading={Check}
              isLoading={isSubmitting}
              type="submit"
            />
          </Box>
        )}
        <Input
          icon={SearchLg}
          placeholder={t('label.search-entity', {
            entity: t('label.related-metric-plural'),
          })}
          value={searchText}
          onChange={setSearchText}
        />
        {isFetching && (
          <Box
            aria-label={t('label.loading')}
            direction="col"
            gap={2}
            role="status">
            <Skeleton height={36} variant="rounded" />
            <Skeleton height={36} variant="rounded" />
          </Box>
        )}
        {!isFetching && error && (
          <Alert
            title={t('server.entity-fetch-error', {
              entity: t('label.metric-plural'),
            })}
            variant="error">
            <Button color="secondary" onPress={() => refetch()}>
              {t('label.try-again')}
            </Button>
          </Alert>
        )}
        {!isFetching && !error && (
          <Box direction="col" gap={2}>
            {options.length ? (
              options.map((option) => (
                <Checkbox
                  isSelected={selectedIds.has(option.value)}
                  key={option.value}
                  label={option.label}
                  onChange={(selected) =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      selected
                        ? next.add(option.value)
                        : next.delete(option.value);
                      onSelectionChange?.(
                        options.filter(({ value }) => next.has(value))
                      );

                      return next;
                    })
                  }
                />
              ))
            ) : (
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('label.no-data')}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </form>
  );
};
