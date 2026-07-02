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
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { SORT_ORDER } from '../../../../enums/common.enum';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { TestSuiteType } from '../../../../enums/TestSuite.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import { EntityReference } from '../../../../generated/entity/type';
import { TestSuite } from '../../../../generated/tests/testCase';
import { usePaging } from '../../../../hooks/paging/usePaging';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import {
  getListTestSuitesBySearch,
  ListTestSuitePramsBySearch,
} from '../../../../rest/testAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import { TestSuiteSearchParams } from '../../DataQuality.interface';

/**
 * Shared headless logic for the Test Suites tab: URL-driven filters
 * (owner/search/sub-tab), paging, sorting, the suites fetch and permission/
 * summary state. Both the OSS renderer and the AI-mode renderer consume this so
 * data fetching lives in one place and only the chrome (filter bar, sub-tab
 * toggle, search) differs per mode.
 */
export const useTestSuitesListPage = () => {
  const { t } = useTranslation();
  const {
    tab = DataQualityPageTabs.TEST_CASES,
    subTab = DataQualitySubTabs.TABLE_SUITES,
  } = useParams<{
    tab?: DataQualityPageTabs;
    subTab?: DataQualitySubTabs;
  }>();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { isTestCaseSummaryLoading, testCaseSummary } =
    useDataQualityProvider();

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

  const { permissions } = usePermissionProvider();
  const { testSuite: testSuitePermission } = permissions;
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [sortDescriptor, setSortDescriptor] = useState<
    SortDescriptor | undefined
  >();
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Guards against out-of-order responses when the tab/filters change mid-fetch
  // (main #29561): only the latest request is allowed to update state.
  const latestRequestId = useRef(0);

  const ownerFilterValue = useMemo(() => {
    return selectedOwner
      ? {
          key: selectedOwner.fullyQualifiedName ?? selectedOwner.name,
          label: getEntityName(selectedOwner),
        }
      : undefined;
  }, [selectedOwner]);

  const columnList = useMemo(
    () => [
      { id: 'name', name: t('label.name'), allowsSorting: true },
      { id: 'tests', name: t('label.test-plural') },
      { id: 'success', name: `${t('label.success')} %` },
      { id: 'owners', name: t('label.owner-plural') },
    ],
    [t]
  );

  const sortedData = useMemo(() => {
    if (!sortDescriptor?.column || !sortDescriptor?.direction) {
      return testSuites;
    }

    return [...testSuites].sort((a, b) => {
      let cmp = 0;
      if (sortDescriptor.column === 'name') {
        const getFqn = (item: TestSuite) =>
          item.basic
            ? item.basicEntityReference?.fullyQualifiedName ?? ''
            : item.fullyQualifiedName ?? '';
        cmp = getFqn(a).localeCompare(getFqn(b));
      }

      return sortDescriptor.direction === 'descending' ? -cmp : cmp;
    });
  }, [testSuites, sortDescriptor]);

  const fetchTestSuites = async (
    page = INITIAL_PAGING_VALUE,
    fetchParams?: ListTestSuitePramsBySearch
  ) => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    setIsLoading(true);
    try {
      const result = await getListTestSuitesBySearch({
        ...fetchParams,
        fields: [TabSpecificField.OWNERS, TabSpecificField.SUMMARY],
        q: searchValue ? `*${searchValue}*` : undefined,
        owner: ownerFilterValue?.key,
        offset: (page - 1) * pageSize,
        includeEmptyTestSuites: subTab !== DataQualitySubTabs.TABLE_SUITES,
        testSuiteType:
          subTab === DataQualitySubTabs.TABLE_SUITES
            ? TestSuiteType.basic
            : TestSuiteType.logical,
        sortField: 'lastResultTimestamp',
        sortType: SORT_ORDER.DESC,
      });
      if (requestId !== latestRequestId.current) {
        return;
      }
      setTestSuites(result.data);
      handlePagingChange(result.paging);
    } catch (error) {
      if (requestId === latestRequestId.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  const handleTestSuitesPageChange = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      // setCurrentPage triggers the fetch effect (currentPage is a dependency);
      // fetching here too would duplicate the request.
      handlePageChange(page);
    },
    [handlePageChange]
  );

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

  useEffect(() => {
    if (
      getPrioritizedViewPermission(testSuitePermission, Operation.ViewBasic)
    ) {
      fetchTestSuites(currentPage, {
        limit: pageSize,
      });
    } else {
      setIsLoading(false);
    }
  }, [testSuitePermission, pageSize, searchValue, owner, subTab, currentPage]);

  return {
    tab,
    subTab,
    params,
    searchValue,
    selectedOwner,
    ownerFilterValue,
    testSuitePermission,
    testSuites,
    sortedData,
    isLoading,
    columnList,
    sortDescriptor,
    setSortDescriptor,
    currentPage,
    pageSize,
    paging,
    showPagination,
    handlePageSizeChange,
    handleTestSuitesPageChange,
    handleSearchParam,
    handleOwnerSelect,
    handleSubTabChange,
    isTestCaseSummaryLoading,
    testCaseSummary,
  };
};
