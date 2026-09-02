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

import { SelectItemType } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty, uniqBy } from 'lodash';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { UUID_REGEX } from '../../../constants/regex.constants';
import { SearchIndex } from '../../../enums/search.enum';
import { ObservabilityFilterResourceDescriptor } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { searchEntity } from '../../../utils/Alerts/AlertsUtil';
import { EntityIconSize } from '../../../utils/EntityIconUtils';
import {
  getEntityName,
  getEntityNameLabel,
} from '../../../utils/EntityNameUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export type AlertAiSearchOption = { label: string; value: string };

type AlertAiSearchHit = {
  _source: {
    displayName?: string;
    entityType?: string;
    fullyQualifiedName?: string;
    id?: string;
    name?: string;
    [key: string]: unknown;
  };
};

/** Fetches selectable non-bot users for AI alert internal destinations. */
export const getAlertAiUserOptions = (
  searchText: string
): Promise<AlertAiSearchOption[]> =>
  searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
    queryFilter: getTermQuery({ isBot: 'false' }),
  });

/** Fetches selectable teams for AI alert internal destinations. */
export const getAlertAiTeamOptions = (
  searchText: string
): Promise<AlertAiSearchOption[]> =>
  searchEntity({ searchText, searchIndex: SearchIndex.TEAM });

const searchAlertAiEntityIdOptions = async ({
  queryFilter,
  searchIndex,
  searchText,
}: {
  queryFilter?: Record<string, unknown>;
  searchIndex: SearchIndex | SearchIndex[];
  searchText: string;
}): Promise<SelectItemType[]> => {
  try {
    const response = await searchQuery({
      pageNumber: 1,
      pageSize: PAGE_SIZE_LARGE,
      query: searchText,
      queryFilter,
      searchIndex,
    });

    return uniqBy(
      (response.hits.hits as AlertAiSearchHit[]).map(({ _source }) => {
        const id = _source.id ?? '';
        const fullyQualifiedName = _source.fullyQualifiedName ?? '';

        return {
          id,
          label: id,
          supportingText: fullyQualifiedName,
        };
      }),
      'id'
    ).filter((item) => Boolean(item.id));
  } catch (error) {
    showErrorToast(error as AxiosError);

    return [];
  }
};

const toSearchSelectItems = (
  hits: AlertAiSearchHit[],
  {
    showDisplayNameAsLabel = true,
    useIdAsValue = false,
    wildcardEntityTypes,
  }: {
    showDisplayNameAsLabel?: boolean;
    useIdAsValue?: boolean;
    wildcardEntityTypes?: string[];
  } = {}
): SelectItemType[] =>
  uniqBy(
    hits.map((hit) => {
      const source = hit._source;
      const fqn = source.fullyQualifiedName ?? '';
      const displayName = showDisplayNameAsLabel ? getEntityName(source) : fqn;
      const isContainerOption =
        Boolean(source.entityType) &&
        (wildcardEntityTypes ?? []).includes(source.entityType ?? '');
      const label = isContainerOption ? `${displayName}.*` : displayName;
      const id = useIdAsValue ? source.id ?? '' : fqn;

      return {
        id,
        label: label || id,
      };
    }),
    'id'
  ).filter((item) => Boolean(item.id));

export const getAlertAiFqnSearchIndexes = (
  selectedSource?: string,
  containerEntities: string[] = []
): SearchIndex[] => {
  const mapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const sourceIndex = selectedSource ? mapping[selectedSource] : undefined;

  if (!sourceIndex) {
    return [];
  }

  if (sourceIndex === SearchIndex.ALL) {
    return [sourceIndex];
  }

  return [selectedSource, ...containerEntities]
    .filter((type): type is string => Boolean(type))
    .map((type) => mapping[type])
    .filter((index): index is SearchIndex => Boolean(index));
};

const searchAlertAiEntityOptions = async ({
  queryFilter,
  searchIndex,
  searchText,
  showDisplayNameAsLabel,
  wildcardEntityTypes,
}: {
  queryFilter?: Record<string, unknown>;
  searchIndex: SearchIndex | SearchIndex[];
  searchText: string;
  showDisplayNameAsLabel?: boolean;
  wildcardEntityTypes?: string[];
}): Promise<SelectItemType[]> => {
  try {
    const response = await searchQuery({
      pageNumber: 1,
      pageSize: PAGE_SIZE_LARGE,
      query: searchText,
      queryFilter,
      searchIndex,
    });

    return toSearchSelectItems(response.hits.hits as AlertAiSearchHit[], {
      showDisplayNameAsLabel,
      wildcardEntityTypes,
    });
  } catch (error) {
    showErrorToast(error as AxiosError);

    return [];
  }
};

type AlertAiArgumentContext = {
  containerEntities: string[];
  selectedSource?: string;
  trimmedSearchText: string;
};

type AlertAiArgumentConfig = {
  searchIndex?: SearchIndex | SearchIndex[];
  queryFilter?: Record<string, unknown>;
  showDisplayNameAsLabel?: boolean;
  wildcardEntityTypes?: string[];
};

const ALERT_AI_ARGUMENT_CONFIG_BUILDERS: Record<
  string,
  (context: AlertAiArgumentContext) => AlertAiArgumentConfig
> = {
  fqnList: ({ selectedSource, containerEntities }) => ({
    searchIndex: getAlertAiFqnSearchIndexes(selectedSource, containerEntities),
    showDisplayNameAsLabel: false,
    wildcardEntityTypes: containerEntities,
  }),
  domainList: () => ({ searchIndex: SearchIndex.DOMAIN }),
  tableNameList: () => ({
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  }),
  entityNameList: () => ({
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  }),
  ownerNameList: () => ({
    searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
    queryFilter: getTermQuery({ isBot: 'false' }),
  }),
  updateByUserList: () => ({ searchIndex: SearchIndex.USER }),
  userList: () => ({
    searchIndex: SearchIndex.USER,
    queryFilter: getTermQuery({ isBot: 'false' }),
  }),
  entityIdList: ({ selectedSource, trimmedSearchText }) => {
    const searchIndexMapping =
      searchClassBase.getEntityTypeSearchIndexMapping();

    return {
      searchIndex: selectedSource
        ? searchIndexMapping[selectedSource]
        : undefined,
      queryFilter: UUID_REGEX.test(trimmedSearchText)
        ? getTermQuery({ id: trimmedSearchText })
        : undefined,
    };
  },
  testSuiteList: () => ({ searchIndex: SearchIndex.TEST_SUITE }),
};

export const searchAlertAiArgumentOptions = async ({
  argument,
  containerEntities = [],
  searchText,
  selectedSource,
}: {
  argument: string;
  containerEntities?: string[];
  searchText: string;
  selectedSource?: string;
}): Promise<SelectItemType[]> => {
  const trimmedSearchText = searchText.trim();
  const buildConfig = ALERT_AI_ARGUMENT_CONFIG_BUILDERS[argument];

  if (!buildConfig) {
    return [];
  }

  const {
    searchIndex,
    queryFilter,
    showDisplayNameAsLabel = true,
    wildcardEntityTypes,
  } = buildConfig({ containerEntities, selectedSource, trimmedSearchText });

  if (!searchIndex || isEmpty(searchIndex)) {
    return [];
  }

  if (argument === 'entityIdList') {
    return searchAlertAiEntityIdOptions({
      queryFilter,
      searchIndex,
      searchText: trimmedSearchText,
    });
  }

  return searchAlertAiEntityOptions({
    queryFilter,
    searchIndex,
    searchText: trimmedSearchText,
    showDisplayNameAsLabel,
    wildcardEntityTypes,
  });
};

/** Builds source dropdown items and preserves a selected source that is not in the current descriptors. */
export const getAlertAiSourceItems = (
  filterResources: ObservabilityFilterResourceDescriptor[],
  selectedSource?: string
) => {
  const items = filterResources
    .map((resource) => resource.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => ({
      icon:
        searchClassBase.getEntityIconWithBg(name, EntityIconSize.Size14) ??
        undefined,
      id: name,
      label: getEntityNameLabel(name),
    }));

  if (
    selectedSource &&
    !items.some((sourceItem) => sourceItem.id === selectedSource)
  ) {
    items.push({
      icon:
        searchClassBase.getEntityIconWithBg(
          selectedSource,
          EntityIconSize.Size14
        ) ?? undefined,
      id: selectedSource,
      label: getEntityNameLabel(selectedSource),
    });
  }

  return items;
};
