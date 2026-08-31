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
  Alert,
  Box,
  Button,
  ComboBox,
  SelectItem,
  Skeleton,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { FC, KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  getMetricGroupByFqn,
  getMetricGroups,
} from '../../../rest/metricGroupsAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';

export interface MetricGroupSelectProps {
  /** The selected group's name, or a new name entered by the user. */
  value?: string;
  onChange?: (groupName?: string, isNewGroup?: boolean) => void;
  'data-testid'?: string;
}

export const metricGroupOptionsQueryKey = () => ['metric-group-options'];
export const metricGroupResolutionQueryKey = (name: string) => [
  'metric-group-resolution',
  name,
];
const METRIC_GROUP_OPTIONS_LIMIT = 50;
const METRIC_GROUP_RESOLUTION_DEBOUNCE_MS = 300;

/**
 * Picks the group a metric belongs to, or names one that does not exist yet.
 *
 * The caller creates a new group before the Metric and compensates by removing it if Metric
 * creation fails. This component only reports whether the chosen name already exists.
 */
const MetricGroupSelect: FC<MetricGroupSelectProps> = ({
  value,
  onChange,
  'data-testid': dataTestId = 'metric-group-select',
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value ?? '');
  const [resolvedInput, setResolvedInput] = useState(value?.trim() ?? '');

  const {
    data: initialGroups,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: metricGroupOptionsQueryKey(),
    queryFn: async () => {
      const response = await getMetricGroups({
        limit: METRIC_GROUP_OPTIONS_LIMIT,
      });

      return response.data ?? [];
    },
  });

  const initialOptions = useMemo(
    () =>
      (initialGroups ?? []).map((group) => ({
        id: group.name,
        label: getEntityName(group),
        supportingText: group.description,
      })),
    [initialGroups]
  );

  const trimmedInput = inputValue.trim();
  const hasInitialExactMatch = initialOptions.some(
    (option) => option.id === trimmedInput
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setResolvedInput(trimmedInput),
      METRIC_GROUP_RESOLUTION_DEBOUNCE_MS
    );

    return () => window.clearTimeout(timeout);
  }, [trimmedInput]);

  useEffect(() => setInputValue(value ?? ''), [value]);

  const resolutionQuery = useQuery({
    queryKey: metricGroupResolutionQueryKey(resolvedInput),
    queryFn: async () => {
      try {
        return await getMetricGroupByFqn(resolvedInput);
      } catch (resolutionError) {
        if (
          isAxiosError(resolutionError) &&
          resolutionError.response?.status === 404
        ) {
          return null;
        }

        throw resolutionError;
      }
    },
    enabled: Boolean(resolvedInput) && !hasInitialExactMatch,
    retry: false,
  });
  const isCurrentResolution = resolvedInput === trimmedInput;
  const resolvedGroup =
    isCurrentResolution && resolutionQuery.data
      ? resolutionQuery.data
      : undefined;
  const options = useMemo(() => {
    if (
      !resolvedGroup ||
      initialOptions.some(({ id }) => id === resolvedGroup.name)
    ) {
      return initialOptions;
    }

    return [
      ...initialOptions,
      {
        id: resolvedGroup.name,
        label: getEntityName(resolvedGroup),
        supportingText: resolvedGroup.description,
      },
    ];
  }, [initialOptions, resolvedGroup]);
  const hasExactMatch = options.some((option) => option.id === trimmedInput);
  const canCreateGroup =
    Boolean(trimmedInput) &&
    !hasExactMatch &&
    isCurrentResolution &&
    resolutionQuery.isSuccess;

  /**
   * The typed name becomes a selectable option so a new group is created by the same gesture as
   * picking an existing one, rather than sending the user off to a separate create screen.
   */
  const items = useMemo(
    () =>
      !canCreateGroup
        ? options
        : [
            ...options,
            {
              id: trimmedInput,
              label: t('label.create-entity', { entity: trimmedInput }),
              supportingText: t('message.metric-group-will-be-created'),
            },
          ],
    [canCreateGroup, options, trimmedInput, t]
  );

  const handleSelectionChange = (key: Key | null) => {
    if (key === null && trimmedInput && !hasExactMatch) {
      if (canCreateGroup) {
        setInputValue(trimmedInput);
        onChange?.(trimmedInput, true);
      }

      return;
    }

    const selected = key === null ? undefined : String(key);
    const isExisting = Boolean(
      selected && options.some((option) => option.id === selected)
    );
    if (
      selected &&
      !isExisting &&
      !(canCreateGroup && selected === trimmedInput)
    ) {
      return;
    }
    setInputValue(selected ?? '');
    onChange?.(selected, Boolean(selected) && !isExisting);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      canCreateGroup
    ) {
      handleSelectionChange(trimmedInput);
    }
  };

  if (isPending) {
    return (
      <span aria-label={t('label.loading')} role="status">
        <Skeleton height={40} variant="rounded" />
      </span>
    );
  }

  if (error) {
    return (
      <Alert
        title={t('server.entity-fetch-error', {
          entity: t('label.metric-group'),
        })}
        variant="error">
        <Button color="secondary" onPress={() => refetch()}>
          {t('label.try-again')}
        </Button>
      </Alert>
    );
  }

  return (
    <Box direction="col" gap={2}>
      <ComboBox
        allowsCustomValue
        aria-label={t('label.metric-group')}
        data-testid={dataTestId}
        hint={
          isCurrentResolution && resolutionQuery.isFetching
            ? t('label.loading')
            : undefined
        }
        inputValue={inputValue}
        items={items}
        placeholder={t('label.select-field', {
          field: t('label.metric-group'),
        })}
        selectedKey={value ?? null}
        showSearchIcon={false}
        onInputChange={setInputValue}
        onKeyDown={handleKeyDown}
        onSelectionChange={handleSelectionChange}>
        {(item) => (
          <SelectItem
            id={item.id}
            key={item.id}
            label={item.label}
            supportingText={item.supportingText}
          />
        )}
      </ComboBox>
      {isCurrentResolution && resolutionQuery.error && (
        <Alert
          title={t('server.entity-fetch-error', {
            entity: t('label.metric-group'),
          })}
          variant="error">
          <Button color="secondary" onPress={() => resolutionQuery.refetch()}>
            {t('label.try-again')}
          </Button>
        </Alert>
      )}
    </Box>
  );
};

export default MetricGroupSelect;
