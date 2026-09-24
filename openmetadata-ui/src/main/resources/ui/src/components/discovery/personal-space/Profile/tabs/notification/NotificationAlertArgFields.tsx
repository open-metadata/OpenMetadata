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
  Autocomplete,
  Box,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty, uniqBy } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DATA_CONTRACT_STATUS_OPTIONS } from '../../../../../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../../../../../constants/constants';
import { EntityType } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { StatusType } from '../../../../../../generated/entity/data/pipeline';
import { PipelineState } from '../../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCaseStatus } from '../../../../../../generated/tests/testCase';
import { EventType } from '../../../../../../generated/type/changeEvent';
import { searchContracts } from '../../../../../../rest/contractAPI';
import { searchQuery } from '../../../../../../rest/searchAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { t } from '../../../../../../utils/i18next/LocalUtil';
import searchClassBase from '../../../../../../utils/SearchClassBase';
import { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

// ─── Search helpers (duplicated from AlertsUtil — those are module-private) ──

const searchEntity = async ({
  searchText,
  searchIndex,
  queryFilter,
  showDisplayNameAsLabel = true,
  wildcardEntityTypes,
}: {
  searchText: string;
  searchIndex: SearchIndex | SearchIndex[];
  queryFilter?: Record<string, unknown>;
  showDisplayNameAsLabel?: boolean;
  wildcardEntityTypes?: string[];
}) => {
  try {
    const response = await searchQuery({
      query: searchText,
      pageNumber: 1,
      pageSize: PAGE_SIZE_LARGE,
      queryFilter,
      searchIndex,
    });

    return uniqBy(
      response.hits.hits.map((d) => {
        const src = d._source as {
          fullyQualifiedName?: string;
          entityType?: string;
          displayName?: string;
          name?: string;
        };
        const displayName = showDisplayNameAsLabel
          ? getEntityName(d._source)
          : src.fullyQualifiedName ?? '';

        const isContainerOption =
          !!src.entityType &&
          (wildcardEntityTypes ?? []).includes(src.entityType);
        const label = isContainerOption ? `${displayName}.*` : displayName;

        return {
          label,
          value: src.fullyQualifiedName ?? '',
        };
      }),
      'label'
    );
  } catch (error) {
    showErrorToast(
      error as AxiosError,
      t('server.entity-fetch-error', { entity: t('label.search') })
    );

    return [];
  }
};

const getFqnSearchIndexes = (
  selectedTrigger: string,
  containerEntities: string[] = []
): SearchIndex[] => {
  const mapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const sourceIndex = mapping[selectedTrigger];

  if (sourceIndex === SearchIndex.ALL) {
    return [sourceIndex];
  }

  return [selectedTrigger, ...containerEntities]
    .map((type) => mapping[type])
    .filter((index): index is SearchIndex => Boolean(index));
};

const getTableSuggestions = async (searchText: string) =>
  searchEntity({
    searchText,
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  });

const getDataContractSuggestions = async (searchText = '') => {
  try {
    const contracts = await searchContracts(searchText, PAGE_SIZE_LARGE);

    return contracts
      .map((contract) => contract.fullyQualifiedName ?? '')
      .filter(Boolean)
      .map((fullyQualifiedName) => ({
        label: fullyQualifiedName,
        value: fullyQualifiedName,
      }));
  } catch (error) {
    showErrorToast(
      error as AxiosError,
      t('server.entity-fetch-error', { entity: t('label.data-contract') })
    );

    return [];
  }
};

const getTestSuiteSuggestions = async (searchText: string) =>
  searchEntity({ searchText, searchIndex: SearchIndex.TEST_SUITE });

const getDomainOptions = async (searchText: string) =>
  searchEntity({ searchText, searchIndex: SearchIndex.DOMAIN });

const getOwnerOptions = async (searchText: string) =>
  searchEntity({
    searchText,
    searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
    queryFilter: getTermQuery({ isBot: 'false' }),
  });

const getUserOptions = async (searchText: string) =>
  searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
    queryFilter: getTermQuery({ isBot: 'false' }),
  });

const getUserBotOptions = async (searchText: string) =>
  searchEntity({ searchText, searchIndex: SearchIndex.USER });

// ─── Core-UI autocomplete components ────────────────────────────────────────

interface AlertAsyncAutocompleteProps {
  api: (search: string) => Promise<{ value: string; label: string }[]>;
  value: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
  'data-testid': string;
  isDisabled?: boolean;
}

const ASYNC_ITEM_CAP = 500;

function AlertAsyncAutocomplete({
  api,
  value,
  onChange,
  placeholder,
  'data-testid': dataTestId,
  isDisabled,
}: AlertAsyncAutocompleteProps) {
  const [asyncItemMap, setAsyncItemMap] = useState<Map<string, SelectItemType>>(
    () => new Map()
  );
  const asyncItems = useMemo(
    () => Array.from(asyncItemMap.values()),
    [asyncItemMap]
  );
  const didSeedRef = useRef(false);

  const selectedItems = useMemo(
    () =>
      value.map(
        (id) => asyncItems.find((item) => item.id === id) ?? { id, label: id }
      ),
    [value.join(','), asyncItems]
  );

  const loadAsync = useCallback(
    async (search: string) => {
      try {
        const results = await api(search);
        const fetched = results.map((item) => ({
          id: String(item.value),
          label: String(
            typeof item.label === 'string' ? item.label : item.value
          ),
        }));
        if (fetched.length === 0) {
          return;
        }
        setAsyncItemMap((prev) => {
          const next = new Map(prev);
          fetched.forEach((item) => {
            next.delete(item.id);
            next.set(item.id, item);
          });
          while (next.size > ASYNC_ITEM_CAP) {
            const oldest = next.keys().next().value;
            if (oldest === undefined) {
              break;
            }
            next.delete(oldest);
          }

          return next;
        });
      } catch {
        // Error handled by the API function
      }
    },
    [api]
  );

  useEffect(() => {
    if (!didSeedRef.current) {
      didSeedRef.current = true;
      loadAsync('');
    }
  }, [loadAsync]);

  const handleItemInserted = useCallback(
    (key: Key) => onChange([...value, String(key)]),
    [value.join(','), onChange]
  );

  const handleItemCleared = useCallback(
    (key: Key) => onChange(value.filter((v) => v !== String(key))),
    [value.join(','), onChange]
  );

  return (
    <Box className="tw:contents" data-testid={dataTestId}>
      <Autocomplete
        filterOption={() => true}
        isDisabled={isDisabled}
        items={asyncItems}
        placeholder={placeholder}
        selectedItems={selectedItems}
        onItemCleared={handleItemCleared}
        onItemInserted={handleItemInserted}
        onSearchChange={loadAsync}>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    </Box>
  );
}

interface AlertStaticAutocompleteProps {
  items: SelectItemType[];
  value: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
  'data-testid': string;
  isDisabled?: boolean;
}

function AlertStaticAutocomplete({
  items,
  value,
  onChange,
  placeholder,
  'data-testid': dataTestId,
  isDisabled,
}: AlertStaticAutocompleteProps) {
  const selectedItems = useMemo(
    () =>
      value.map(
        (id) => items.find((item) => item.id === id) ?? { id, label: id }
      ),
    [value.join(','), items]
  );

  const handleItemInserted = useCallback(
    (key: Key) => onChange([...value, String(key)]),
    [value.join(','), onChange]
  );

  const handleItemCleared = useCallback(
    (key: Key) => onChange(value.filter((v) => v !== String(key))),
    [value.join(','), onChange]
  );

  return (
    <Box className="tw:contents" data-testid={dataTestId}>
      <Autocomplete
        isDisabled={isDisabled}
        items={items}
        placeholder={placeholder}
        selectedItems={selectedItems}
        onItemCleared={handleItemCleared}
        onItemInserted={handleItemInserted}>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    </Box>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const enumToSelectItems = (enumObj: Record<string, string>): SelectItemType[] =>
  Object.values(enumObj).map((v) => ({ id: v, label: v }));

const valuesToSelectItems = (values: string[]): SelectItemType[] =>
  values.map((v) => ({ id: v, label: v }));

// ─── Public API ─────────────────────────────────────────────────────────────

export const getControlledArgumentFieldCoreUI = (
  argument: string,
  value: string[],
  onChange: (val: string[]) => void,
  selectedTrigger: string,
  containerEntities: string[] = [],
  supportedEventTypes: EventType[] = [],
  isDisabled = false
): JSX.Element => {
  const getEntityByFQN = async (searchText: string) => {
    if (selectedTrigger === EntityType.DATA_CONTRACT) {
      return getDataContractSuggestions(searchText);
    }

    return searchEntity({
      searchText,
      searchIndex: getFqnSearchIndexes(selectedTrigger, containerEntities),
      showDisplayNameAsLabel: false,
      wildcardEntityTypes: containerEntities,
    });
  };

  const translatedContractStatusOptions = DATA_CONTRACT_STATUS_OPTIONS.map(
    (option) => ({ id: String(option.value), label: t(option.label) })
  );

  const asyncField = (
    api: (search: string) => Promise<{ value: string; label: string }[]>,
    testId: string,
    placeholder: string
  ) => (
    <AlertAsyncAutocomplete
      api={api}
      data-testid={testId}
      isDisabled={isDisabled}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  );

  const staticField = (
    items: SelectItemType[],
    testId: string,
    placeholder: string
  ) => (
    <AlertStaticAutocomplete
      data-testid={testId}
      isDisabled={isDisabled}
      items={items}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  );

  const fieldRenderers: Record<string, () => JSX.Element> = {
    fqnList: () =>
      asyncField(
        getEntityByFQN,
        'fqn-list-select',
        t('label.search-by-type', { type: t('label.fqn-uppercase') })
      ),
    domainList: () =>
      asyncField(
        getDomainOptions,
        'domain-select',
        t('label.search-by-type', { type: t('label.domain-lowercase') })
      ),
    tableNameList: () =>
      asyncField(
        getTableSuggestions,
        'table-name-select',
        t('label.search-by-type', { type: t('label.table-lowercase') })
      ),
    entityNameList: () =>
      asyncField(
        getTableSuggestions,
        'entity-name-select',
        t('label.search-by-type', { type: t('label.entity-lowercase') })
      ),
    ownerNameList: () =>
      asyncField(
        getOwnerOptions,
        'owner-name-select',
        t('label.search-by-type', {
          type: t('label.owner-lowercase-plural'),
        })
      ),
    updateByUserList: () =>
      asyncField(
        getUserBotOptions,
        'updater-name-select',
        t('label.search-by-type', { type: t('label.user') })
      ),
    userList: () =>
      asyncField(
        getUserOptions,
        'user-name-select',
        t('label.search-by-type', { type: t('label.user') })
      ),
    eventTypeList: () =>
      staticField(
        isEmpty(supportedEventTypes)
          ? enumToSelectItems(EventType)
          : valuesToSelectItems(supportedEventTypes),
        'event-type-select',
        t('label.search-by-type', { type: t('label.event-type-lowercase') })
      ),
    pipelineStateList: () =>
      staticField(
        enumToSelectItems(StatusType),
        'pipeline-status-select',
        t('label.select-field', { field: t('label.pipeline-state') })
      ),
    ingestionPipelineStateList: () =>
      staticField(
        enumToSelectItems(PipelineState),
        'pipeline-status-select',
        t('label.select-field', { field: t('label.pipeline-state') })
      ),
    testStatusList: () =>
      staticField(
        enumToSelectItems(TestCaseStatus),
        'test-status-select',
        t('label.select-field', { field: t('label.test-suite-status') })
      ),
    testResultList: () =>
      staticField(
        enumToSelectItems(TestCaseStatus),
        'test-result-select',
        t('label.select-field', { field: t('label.test-case-result') })
      ),
    contractStatusList: () =>
      staticField(
        translatedContractStatusOptions,
        'contract-status-select',
        t('label.select-field', { field: t('label.data-contract-status') })
      ),
    testSuiteList: () =>
      asyncField(
        getTestSuiteSuggestions,
        'test-suite-select',
        t('label.search-by-type', { type: t('label.test-suite') })
      ),
  };

  return fieldRenderers[argument]?.() ?? <></>;
};
