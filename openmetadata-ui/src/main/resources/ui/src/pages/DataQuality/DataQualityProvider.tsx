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
import { AxiosError } from 'axios';
import { isEmpty, pick } from 'lodash';
import QueryString from 'qs';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DataQualityPageParams } from '../../components/DataQuality/DataQuality.interface';
import { INITIAL_TEST_SUMMARY } from '../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { Operation } from '../../generated/entity/policies/policy';
import { TestSummary } from '../../generated/tests/testCase';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import {
  fetchEntityCoveredWithDQ,
  fetchTestCaseSummary,
  fetchTotalEntityCount,
} from '../../rest/dataQualityDashboardAPI';
import { transformToTestCaseStatusObject } from '../../utils/DataQuality/DataQualityUtils';
import { getPrioritizedViewPermission } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import {
  DataQualityContextInterface,
  DataQualityPageTabs,
} from './DataQualityPage.interface';

export const DataQualityContext = createContext<DataQualityContextInterface>(
  {} as DataQualityContextInterface
);

const DataQualityProvider = ({ children }: { children: React.ReactNode }) => {
  const { tab: activeTab = DataQualityPageTabs.TEST_CASES } =
    useRequiredParams<{
      tab: DataQualityPageTabs;
    }>();
  const location = useCustomLocation();
  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as DataQualityPageParams;
  }, [location.search]);

  // Extract only filter-related parameters, excluding pagination
  const filterParams = useMemo(() => {
    const { currentPage, pageSize, ...filters } = params;

    return filters;
  }, [params]);

  // Create a stable key for filter changes to prevent unnecessary re-renders
  const filterKey = useMemo(() => {
    return !isEmpty(filterParams) ? JSON.stringify(filterParams) : null;
  }, [filterParams]);

  const [testCaseSummary, setTestCaseSummary] =
    useState<TestSummary>(INITIAL_TEST_SUMMARY);
  const [isTestCaseSummaryLoading, setIsTestCaseSummaryLoading] =
    useState(true);

  const { permissions } = usePermissionProvider();
  const { testCase: testCasePermission } = permissions;

  const dataQualityContextValue = useMemo(() => {
    return {
      testCaseSummary,
      isTestCaseSummaryLoading,
      activeTab,
    };
  }, [testCaseSummary, isTestCaseSummaryLoading, activeTab]);

  const fetchTestSummary = async (params?: DataQualityPageParams) => {
    const filters = {
      ...pick(params, [
        'tags',
        'serviceName',
        'testPlatforms',
        'dataQualityDimension',
        'testCaseStatus',
        'testCaseType',
      ]),
      ownerFqn: params?.owner ? JSON.parse(params.owner)?.name : undefined,
      tier: params?.tier ? [params.tier] : undefined,
      entityFQN: params?.tableFqn,
    };

    setIsTestCaseSummaryLoading(true);
    try {
      const { data } = await fetchTestCaseSummary(filters);
      const { data: unhealthyData } = await fetchEntityCoveredWithDQ(
        filters,
        true
      );
      const { data: totalDQCoverage } = await fetchEntityCoveredWithDQ(
        filters,
        false
      );

      const { data: entityCount } = await fetchTotalEntityCount(filters);

      const unhealthy = parseInt(unhealthyData[0].originEntityFQN);
      const total = parseInt(totalDQCoverage[0].originEntityFQN);
      let totalEntityCount = parseInt(entityCount[0].fullyQualifiedName);

      if (total > totalEntityCount) {
        totalEntityCount = total;
      }

      const updatedData = transformToTestCaseStatusObject(data);
      setTestCaseSummary({
        ...updatedData,
        unhealthy,
        healthy: total - unhealthy,
        totalDQEntities: total,
        totalEntityCount,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestCaseSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (getPrioritizedViewPermission(testCasePermission, Operation.ViewBasic)) {
      fetchTestSummary(filterParams);
    } else {
      setIsTestCaseSummaryLoading(false);
    }
  }, [filterKey]);

  return (
    <DataQualityContext.Provider value={dataQualityContextValue}>
      {children}
    </DataQualityContext.Provider>
  );
};

export const useDataQualityProvider = () => useContext(DataQualityContext);

export default DataQualityProvider;
