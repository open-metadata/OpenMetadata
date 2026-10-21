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
import { uniqBy } from 'lodash';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import type { AlertSourceSearch } from '../../../utils/Alerts/AlertSourceSearch';
import { searchEntity } from '../../../utils/Alerts/AlertsUtil';
import { getEntityName } from '../../../utils/EntityNameUtils';
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

const toSearchSelectItems = (
  hits: AlertAiSearchHit[],
  showDisplayNameAsLabel: boolean
): SelectItemType[] =>
  uniqBy(
    hits.map(({ _source: source }) => {
      const fqn = source.fullyQualifiedName ?? '';
      const label = showDisplayNameAsLabel ? getEntityName(source) : fqn;

      return { id: fqn, label: label || fqn };
    }),
    'id'
  ).filter((item) => Boolean(item.id));

type AlertAiArgumentConfig = {
  searchIndex: SearchIndex | SearchIndex[];
  queryFilter?: Record<string, unknown>;
  showDisplayNameAsLabel?: boolean;
};

// The arguments that search what the chosen sources hold go through the source search instead.
const ALERT_AI_ARGUMENT_CONFIGS: Record<string, AlertAiArgumentConfig> = {
  domainList: { searchIndex: SearchIndex.DOMAIN },
  tableNameList: {
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  },
  entityNameList: {
    searchIndex: SearchIndex.TABLE,
    showDisplayNameAsLabel: false,
  },
  ownerNameList: {
    searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
    queryFilter: getTermQuery({ isBot: 'false' }),
  },
  updateByUserList: { searchIndex: SearchIndex.USER },
  userList: {
    searchIndex: SearchIndex.USER,
    queryFilter: getTermQuery({ isBot: 'false' }),
  },
  testSuiteList: { searchIndex: SearchIndex.TEST_SUITE },
};

const SOURCE_ARGUMENT_SEARCHERS: Record<
  string,
  (search: AlertSourceSearch, text: string) => Promise<SelectItemType[]>
> = {
  fqnList: async (search, text) =>
    (await search.byName(text)).map(({ value, label }) => ({
      id: value,
      label,
    })),
  entityIdList: async (search, text) =>
    (await search.byId(text)).map(({ id, fullyQualifiedName }) => ({
      id,
      label: id,
      supportingText: fullyQualifiedName,
    })),
};

const searchIndexedOptions = async (
  {
    searchIndex,
    queryFilter,
    showDisplayNameAsLabel = true,
  }: AlertAiArgumentConfig,
  searchText: string
): Promise<SelectItemType[]> => {
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE_LARGE,
    query: searchText,
    queryFilter,
    searchIndex,
  });

  return toSearchSelectItems(
    response.hits.hits as AlertAiSearchHit[],
    showDisplayNameAsLabel
  );
};

/**
 * The options a rule argument offers for what has been typed. Names and ids come from what the
 * chosen sources hold, through their search; the other arguments search a fixed index.
 */
export const searchAlertAiArgumentOptions = async ({
  argument,
  searchText,
  sourceSearch,
}: {
  argument: string;
  searchText: string;
  sourceSearch: AlertSourceSearch;
}): Promise<SelectItemType[]> => {
  const trimmedSearchText = searchText.trim();
  const searchSources = SOURCE_ARGUMENT_SEARCHERS[argument];
  const config = ALERT_AI_ARGUMENT_CONFIGS[argument];

  try {
    if (searchSources) {
      return await searchSources(sourceSearch, trimmedSearchText);
    }

    return config ? await searchIndexedOptions(config, trimmedSearchText) : [];
  } catch (error) {
    showErrorToast(error as AxiosError);

    return [];
  }
};
