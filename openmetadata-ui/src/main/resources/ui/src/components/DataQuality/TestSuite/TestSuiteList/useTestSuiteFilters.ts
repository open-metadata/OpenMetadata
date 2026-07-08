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
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityReference } from '../../../../generated/entity/type';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../../pages/DataQuality/DataQualityPage.interface';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { TestSuiteSearchParams } from '../../DataQuality.interface';

export interface UseTestSuiteFiltersProps {
  tab: DataQualityPageTabs;
}

/**
 * Owns the URL-driven FILTERS concern for the Test Suites tab: the parsed query
 * params, the derived owner (kept verbatim, including the hand-edited-JSON
 * guard) and the handlers that mutate the URL (search/owner) or navigate on a
 * sub-tab change. The active `tab` is injected so the sub-tab navigation can
 * resolve its target path. QueryString parse/stringify stays hand-rolled.
 */
export const useTestSuiteFilters = ({ tab }: UseTestSuiteFiltersProps) => {
  const navigate = useNavigate();
  const location = useCustomLocation();

  const params = useMemo(() => {
    const search = location.search;

    const parsed = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return parsed as TestSuiteSearchParams;
  }, [location.search]);
  const { searchValue, owner } = params;
  const selectedOwner = useMemo(() => {
    if (!owner) {
      return undefined;
    }
    try {
      return JSON.parse(owner);
    } catch {
      // A malformed/hand-edited owner query param must not crash the render.
      return undefined;
    }
  }, [owner]);

  const ownerFilterValue = useMemo(() => {
    return selectedOwner
      ? {
          key: selectedOwner.fullyQualifiedName ?? selectedOwner.name,
          label: getEntityName(selectedOwner),
        }
      : undefined;
  }, [selectedOwner]);

  const handleSearchParam = (
    value: string,
    key: keyof TestSuiteSearchParams
  ) => {
    navigate({
      search: QueryString.stringify({
        ...params,
        [key]: isEmpty(value) ? undefined : value,
      }),
    });
  };

  const handleOwnerSelect = (owners: EntityReference[] = []) => {
    handleSearchParam(
      owners?.length > 0 ? JSON.stringify(owners?.[0]) : '',
      'owner'
    );
  };

  const handleSubTabChange = (keys: Set<string | number>) => {
    const selected = [...keys][0] as DataQualitySubTabs;
    if (selected) {
      navigate(
        observabilityRouterClassBase.getDataQualityPagePath(tab, selected)
      );
    }
  };

  return {
    params,
    searchValue,
    owner,
    selectedOwner,
    ownerFilterValue,
    handleSearchParam,
    handleOwnerSelect,
    handleSubTabChange,
  };
};
