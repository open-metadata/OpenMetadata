/*
 *  Copyright 2023 Collate.
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
import { isEmpty, isUndefined } from 'lodash';
import { DateTime } from 'luxon';
import Qs from 'qs';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import { Table } from '../../generated/entity/data/table';
import { ProfileSampleType } from '../../generated/metadataIngestion/databaseServiceProfilerPipeline';
import { TestCase } from '../../generated/tests/testCase';
import {
  getLatestTableProfileByFqn,
  getTableDetailsByFQN,
} from '../../rest/tableAPI';
import { getListTestCase, ListTestCaseParams } from '../../rest/testAPI';
import { bytesToSize, getDecodedFqn } from '../../utils/StringsUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import { useTourProvider } from '../TourProvider/TourProvider';
import ProfilerSettingsModal from './Component/ProfilerSettingsModal';
import {
  OverallTableSummaryType,
  SplitTestCasesType,
  TableProfilerContextType,
  TableProfilerProviderProps,
} from './TableProfiler.interface';

export const TableProfilerContext = createContext<TableProfilerContextType>(
  {} as TableProfilerContextType
);

export const TableProfilerProvider = ({
  children,
  permissions,
  isTableDeleted,
}: TableProfilerProviderProps) => {
  const { t } = useTranslation();
  const { fqn: datasetFQN } = useParams<{ fqn: string }>();
  const { isTourOpen } = useTourProvider();
  // profiler has its own api but sent's the data in Table type
  const [tableProfiler, setTableProfiler] = useState<Table>();
  // customMetric is fetch from table api and has response type of Table
  const [customMetric, setCustomMetric] = useState<Table>();
  const [isTestsLoading, setIsTestsLoading] = useState(true);
  const [isProfilerDataLoading, setIsProfilerDataLoading] = useState(true);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [settingModalVisible, setSettingModalVisible] = useState(false);
  const [splitTestCases, setSplitTestCases] = useState<SplitTestCasesType>({
    column: [],
    table: [],
  });

  const {
    activeTab = isTourOpen
      ? TableProfilerTab.COLUMN_PROFILE
      : TableProfilerTab.TABLE_PROFILE,
  } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeTab: string; activeColumnFqn: string };
  }, [location.search, isTourOpen]);

  const isColumnProfile = activeTab === TableProfilerTab.COLUMN_PROFILE;
  const isDataQuality = activeTab === TableProfilerTab.DATA_QUALITY;
  const isTableProfile = activeTab === TableProfilerTab.TABLE_PROFILE;

  const viewTest = useMemo(() => {
    return (
      permissions.ViewAll || permissions.ViewBasic || permissions.ViewTests
    );
  }, [permissions]);

  const getProfileSampleValue = () => {
    const profile = tableProfiler?.profile;
    let value;
    if (profile?.profileSampleType === ProfileSampleType.Percentage) {
      value = `${profile?.profileSample ?? 100}%`;
    } else if (profile?.profileSampleType === ProfileSampleType.Rows) {
      value = `${profile?.profileSample} ${
        profile?.profileSampleType.toString().length > 1
          ? t('label.row-plural')
          : t('label.row')
      } `;
    } else {
      value = '100%';
    }

    return value;
  };

  const overallSummary: OverallTableSummaryType[] = useMemo(() => {
    const profile = tableProfiler?.profile;

    return [
      {
        title: t('label.entity-count', {
          entity: t('label.row'),
        }),
        value: profile?.rowCount ?? 0,
      },
      {
        title: t('label.column-entity', {
          entity: t('label.count'),
        }),
        value: profile?.columnCount ?? tableProfiler?.columns.length ?? 0,
      },
      {
        title: `${t('label.profile-sample-type', { type: '' })}`,
        value: getProfileSampleValue(),
      },
      {
        title: t('label.size'),
        value: bytesToSize(profile?.sizeInByte ?? 0),
      },
      {
        title: t('label.created-date'),
        value: profile?.createDateTime
          ? DateTime.fromJSDate(new Date(profile?.createDateTime))
              .toUTC()
              .toFormat('MMM dd, yyyy HH:mm')
          : '--',
      },
    ];
  }, [tableProfiler]);

  const splitTableAndColumnTest = (data: TestCase[]) => {
    const columnTestsCase: TestCase[] = [];
    const tableTests: TestCase[] = [];
    data.forEach((test) => {
      if (test.entityFQN === datasetFQN) {
        tableTests.push(test);
      } else {
        columnTestsCase.push(test);
      }
    });
    setSplitTestCases({ column: columnTestsCase, table: tableTests });
  };

  const onTestCaseUpdate = useCallback(
    (testCase?: TestCase) => {
      if (isUndefined(testCase)) {
        return;
      }
      setAllTestCases((prevTestCases) => {
        const updatedTests = prevTestCases.map((test) => {
          return testCase.id === test.id ? { ...test, ...testCase } : test;
        });
        splitTableAndColumnTest(updatedTests);

        return updatedTests;
      });
    },
    [allTestCases]
  );

  const handleSettingModal = (visible: boolean) => {
    setSettingModalVisible(visible);
  };

  const fetchLatestProfilerData = async () => {
    // As we are encoding the fqn in API function to apply all over the application
    // and the datasetFQN comes form url parameter which is already encoded,
    // we are decoding FQN below to avoid double encoding in the API function
    const decodedDatasetFQN = decodeURIComponent(datasetFQN);
    setIsProfilerDataLoading(true);
    try {
      const profiler = await getLatestTableProfileByFqn(decodedDatasetFQN);
      const customMetricResponse = await getTableDetailsByFQN(
        decodedDatasetFQN,
        'customMetrics,columns'
      );

      setTableProfiler(profiler);
      setCustomMetric(customMetricResponse);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsProfilerDataLoading(false);
    }
  };

  const fetchAllTests = async (params?: ListTestCaseParams) => {
    setIsTestsLoading(true);
    try {
      const { data } = await getListTestCase({
        ...params,
        fields: 'testCaseResult, testDefinition',
        entityLink: generateEntityLink(getDecodedFqn(datasetFQN) ?? ''),
        includeAllTests: true,
        limit: API_RES_MAX_SIZE,
      });
      splitTableAndColumnTest(data);
      setAllTestCases(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestsLoading(false);
    }
  };

  useEffect(() => {
    const fetchProfiler =
      !isTableDeleted &&
      datasetFQN &&
      !isTourOpen &&
      (isTableProfile || isColumnProfile) &&
      isUndefined(tableProfiler);

    if (fetchProfiler) {
      fetchLatestProfilerData();
    } else {
      setIsProfilerDataLoading(false);
    }
    if (isTourOpen) {
      setTableProfiler(mockDatasetData.tableDetails as unknown as Table);
    }
  }, [datasetFQN, isTourOpen, isTableProfile, isColumnProfile]);

  useEffect(() => {
    const fetchTest =
      viewTest &&
      !isTourOpen &&
      (isDataQuality || isColumnProfile) &&
      isEmpty(allTestCases);

    if (fetchTest) {
      fetchAllTests();
    } else {
      setIsTestsLoading(false);
    }
  }, [viewTest, isTourOpen, isDataQuality, isColumnProfile]);

  const tableProfilerPropsData: TableProfilerContextType = useMemo(() => {
    return {
      isTestsLoading,
      isProfilerDataLoading,
      tableProfiler,
      allTestCases,
      permissions,
      isTableDeleted,
      overallSummary,
      onTestCaseUpdate,
      onSettingButtonClick: () => setSettingModalVisible(true),
      fetchAllTests,
      isProfilingEnabled: !isUndefined(tableProfiler?.profile),
      splitTestCases,
      customMetric,
    };
  }, [
    isTestsLoading,
    isProfilerDataLoading,
    tableProfiler,
    allTestCases,
    permissions,
    isTableDeleted,
    overallSummary,
    onTestCaseUpdate,
    splitTestCases,
    customMetric,
  ]);

  return (
    <TableProfilerContext.Provider value={tableProfilerPropsData}>
      {children}
      {settingModalVisible && (
        <ProfilerSettingsModal
          columns={tableProfiler?.columns ?? []}
          tableId={tableProfiler?.id ?? ''}
          visible={settingModalVisible}
          onVisibilityChange={handleSettingModal}
        />
      )}
    </TableProfilerContext.Provider>
  );
};

export const useTableProfiler = () => useContext(TableProfilerContext);
