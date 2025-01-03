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
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { INITIAL_TEST_SUMMARY } from '../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { TestSummary } from '../../generated/tests/testCase';
import {
  fetchEntityCoveredWithDQ,
  fetchTestCaseSummary,
  fetchTotalEntityCount,
} from '../../rest/dataQualityDashboardAPI';
import { transformToTestCaseStatusObject } from '../../utils/DataQuality/DataQualityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  DataQualityContextInterface,
  DataQualityPageTabs,
} from './DataQualityPage.interface';

export const DataQualityContext = createContext<DataQualityContextInterface>(
  {} as DataQualityContextInterface
);

const DataQualityProvider = ({ children }: { children: React.ReactNode }) => {
  const { tab: activeTab } = useParams<{ tab: DataQualityPageTabs }>();
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

  const fetchTestSummary = async () => {
    setIsTestCaseSummaryLoading(true);
    try {
      const { data } = await fetchTestCaseSummary();
      const { data: unhealthyData } = await fetchEntityCoveredWithDQ(
        undefined,
        true
      );
      const { data: totalDQCoverage } = await fetchEntityCoveredWithDQ(
        undefined,
        false
      );

      const { data: entityCount } = await fetchTotalEntityCount();

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
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      fetchTestSummary();
    } else {
      setIsTestCaseSummaryLoading(false);
    }
  }, []);

  return (
    <DataQualityContext.Provider value={dataQualityContextValue}>
      {children}
    </DataQualityContext.Provider>
  );
};

export const useDataQualityProvider = () => useContext(DataQualityContext);

export default DataQualityProvider;
