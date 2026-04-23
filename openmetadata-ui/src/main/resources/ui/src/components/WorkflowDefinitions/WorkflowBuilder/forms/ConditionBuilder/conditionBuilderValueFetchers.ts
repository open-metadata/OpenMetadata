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

import { PAGE_SIZE_MEDIUM } from '../../../../../constants/constants';
import { SearchIndex } from '../../../../../enums/search.enum';
import { searchData } from '../../../../../rest/miscAPI';
import { getTags } from '../../../../../rest/tagAPI';
import { searchEntity } from '../../../../../utils/Alerts/AlertsUtil';
import {
  formatTeamsResponse,
  formatUsersResponse,
} from '../../../../../utils/APIUtils';
import { getEntityName } from '../../../../../utils/EntityUtils';
import type { ConditionBuilderOption } from './ConditionBuilder.interface';

const PAGE_SIZE_LARGE = 1000;

export async function fetchCertificationOptions(
  _searchText: string
): Promise<ConditionBuilderOption[]> {
  try {
    const response = await getTags({
      limit: PAGE_SIZE_LARGE,
      parent: 'Certification',
    });
    const data = response.data ?? [];

    return data
      .map((tag) => ({
        value: tag.fullyQualifiedName ?? tag.name ?? '',
        label: tag.displayName ?? tag.name ?? '',
      }))
      .filter((o) => o.value);
  } catch {
    return [];
  }
}

export async function fetchDataProductOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  try {
    const options = await searchEntity({
      searchText: searchText || '*',
      searchIndex: SearchIndex.DATA_PRODUCT,
      setSourceAsValue: false,
    });

    return options.map((o) => ({ value: o.value, label: o.label }));
  } catch {
    return [];
  }
}

export async function fetchDomainOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  try {
    const options = await searchEntity({
      searchText: searchText || '*',
      searchIndex: SearchIndex.DOMAIN,
      setSourceAsValue: false,
    });

    return options.map((o) => ({ value: o.value, label: o.label }));
  } catch {
    return [];
  }
}

export async function fetchExpertOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  try {
    const res = await searchData(
      searchText,
      1,
      PAGE_SIZE_MEDIUM,
      'isBot:false',
      '',
      '',
      SearchIndex.USER,
      false,
      false,
      true
    );
    const users = formatUsersResponse(res.data.hits.hits);

    return users
      .map((user) => ({
        value: user.fullyQualifiedName ?? '',
        label: getEntityName(user),
      }))
      .filter((o) => o.value);
  } catch {
    return [];
  }
}

export async function fetchGlossaryOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  try {
    const options = await searchEntity({
      searchText: searchText || '*',
      searchIndex: SearchIndex.GLOSSARY_TERM,
      setSourceAsValue: false,
    });

    return options.map((o) => ({ value: o.value, label: o.label }));
  } catch {
    return [];
  }
}

export async function fetchOwnerOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  try {
    const [userRes, teamRes] = await Promise.all([
      searchData(
        searchText,
        1,
        PAGE_SIZE_MEDIUM,
        'isBot:false',
        '',
        '',
        SearchIndex.USER,
        false,
        false,
        true
      ),
      searchData(
        searchText,
        1,
        PAGE_SIZE_MEDIUM,
        '',
        '',
        '',
        SearchIndex.TEAM,
        false,
        false,
        true
      ),
    ]);
    const users = formatUsersResponse(userRes.data.hits.hits);
    const teams = formatTeamsResponse(teamRes.data.hits.hits);
    const userOpts = users.map((user) => ({
      value: user.fullyQualifiedName ?? '',
      label: getEntityName(user),
    }));
    const teamOpts = teams.map((team) => ({
      value: team.fullyQualifiedName ?? '',
      label: getEntityName(team),
    }));

    return [...userOpts, ...teamOpts].filter((o) => o.value);
  } catch {
    return [];
  }
}

export async function fetchRelatedTermsOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  return fetchGlossaryOptions(searchText);
}

export async function fetchSynonymsOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  return fetchGlossaryOptions(searchText);
}

export async function fetchTagOptions(
  searchText: string
): Promise<ConditionBuilderOption[]> {
  try {
    const options = await searchEntity({
      searchText: searchText.trim() || '*',
      searchIndex: SearchIndex.TAG,
      setSourceAsValue: false,
    });

    return options.map((o) => ({ value: o.value, label: o.label }));
  } catch {
    return [];
  }
}
