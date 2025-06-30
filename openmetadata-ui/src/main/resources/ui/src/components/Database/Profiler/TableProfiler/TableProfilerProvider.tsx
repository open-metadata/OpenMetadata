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
import { isUndefined } from 'lodash';
import { DateTime } from 'luxon';
import { DateRangeObject } from 'Models';
import Qs from 'qs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { mockDatasetData } from '../../../../constants/mockTourData.constants';
import {
  DEFAULT_RANGE_DATA,
  DEFAULT_SORT_ORDER,
} from '../../../../constants/profiler.constant';
import { useTourProvider } from '../../../../context/TourProvider/TourProvider';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { Table } from '../../../../generated/entity/data/table';
import { ProfileSampleType } from '../../../../generated/metadataIngestion/databaseServiceProfilerPipeline';
import { TestCase } from '../../../../generated/tests/testCase';
import { Include } from '../../../../generated/type/include';
import { usePaging } from '../../../../hooks/paging/usePaging';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../hooks/useFqn';
import {
  getLatestTableProfileByFqn,
  getTableDetailsByFQN,
} from '../../../../rest/tableAPI';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
} from '../../../../rest/testAPI';
import { bytesToSize } from '../../../../utils/StringsUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import ProfilerSettingsModal from './ProfilerSettingsModal/ProfilerSettingsModal';
import {
  OverallTableSummaryType,
  TableProfilerContextInterface,
  TableProfilerProviderProps,
} from './TableProfiler.interface';

export const TableProfilerContext =
  createContext<TableProfilerContextInterface>(
    {} as TableProfilerContextInterface
  );

export const TableProfilerProvider = ({
  children,
  permissions,
  table,
  testCaseSummary,
}: TableProfilerProviderProps) => {
  const { t } = useTranslation();
  const { fqn: datasetFQN } = useFqn();
  const { isTourOpen } = useTourProvider();
  const testCasePaging = usePaging();
  const location = useCustomLocation();
  // profiler has its own api but sent's the data in Table type
  const [tableProfiler, setTableProfiler] = useState<Table>();
  // customMetric is fetch from table api and has response type of Table
  const [customMetric, setCustomMetric] = useState<Table>();
  const [isTestsLoading, setIsTestsLoading] = useState(true);
  const [isProfilerDataLoading, setIsProfilerDataLoading] = useState(true);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [settingModalVisible, setSettingModalVisible] = useState(false);
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);

  const isTableDeleted = useMemo(() => table?.deleted, [table]);

  const {
    activeTab = isTourOpen
      ? TableProfilerTab.COLUMN_PROFILE
      : TableProfilerTab.TABLE_PROFILE,
  } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as {
      activeTab: TableProfilerTab;
      activeColumnFqn: string;
    };
  }, [location.search, isTourOpen]);

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
        key: 'row-count',
        value: profile?.rowCount ?? 0,
      },
      {
        title: t('label.column-entity', {
          entity: t('label.count'),
        }),
        key: 'column-count',
        value: profile?.columnCount ?? tableProfiler?.columns?.length ?? 0,
      },
      {
        title: `${t('label.profile-sample-type', { type: '' })}`,
        key: 'profile-sample-type',
        value: getProfileSampleValue(),
      },
      {
        title: t('label.size'),
        key: 'size',
        value: bytesToSize(profile?.sizeInByte ?? 0),
      },
      {
        title: t('label.created-date'),
        key: 'created-date',
        value: profile?.createDateTime
          ? DateTime.fromJSDate(new Date(profile?.createDateTime))
              .toUTC()
              .toLocaleString(DateTime.DATE_MED)
          : '--',
      },
    ];
  }, [tableProfiler]);

  const handleDateRangeChange = (data: DateRangeObject) => {
    setDateRangeObject(data);
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

        return updatedTests;
      });
    },
    [allTestCases]
  );

  const handleSettingModal = (visible: boolean) => {
    setSettingModalVisible(visible);
  };
  const handleUpdateCustomMetrics = (customMetric: Table) => {
    setCustomMetric(customMetric);
  };

  const fetchLatestProfilerData = async () => {
    // As we are encoding the fqn in API function to apply all over the application
    // and the datasetFQN comes form url parameter which is already encoded,
    // we are decoding FQN below to avoid double encoding in the API function
    setIsProfilerDataLoading(true);
    try {
      const profiler = await getLatestTableProfileByFqn(datasetFQN);
      const customMetricResponse = await getTableDetailsByFQN(datasetFQN, {
        fields: [TabSpecificField.CUSTOM_METRICS, TabSpecificField.COLUMNS],
      });

      setTableProfiler(profiler);
      setCustomMetric(customMetricResponse);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsProfilerDataLoading(false);
    }
  };

  const fetchAllTests = async (params?: ListTestCaseParamsBySearch) => {
    setIsTestsLoading(true);
    try {
      const { data, paging } = await getListTestCaseBySearch({
        ...DEFAULT_SORT_ORDER,
        ...params,
        fields: [
          TabSpecificField.TEST_CASE_RESULT,
          TabSpecificField.INCIDENT_ID,
        ],

        entityLink: generateEntityLink(datasetFQN ?? ''),
        includeAllTests: true,
        limit: testCasePaging.pageSize,
        include: isTableDeleted ? Include.Deleted : Include.NonDeleted,
      });

      setAllTestCases(data);
      testCasePaging.handlePagingChange(paging);
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
      [
        TableProfilerTab.TABLE_PROFILE,
        TableProfilerTab.COLUMN_PROFILE,
      ].includes(activeTab) &&
      isUndefined(tableProfiler);

    if (fetchProfiler) {
      fetchLatestProfilerData();
    } else {
      setIsProfilerDataLoading(false);
    }
    if (isTourOpen) {
      setTableProfiler(mockDatasetData.tableDetails as unknown as Table);
    }
  }, [datasetFQN, isTourOpen, activeTab]);

  useEffect(() => {
    const fetchTest =
      !isTourOpen && activeTab === TableProfilerTab.DATA_QUALITY && viewTest;

    if (fetchTest) {
      fetchAllTests();
    } else {
      setAllTestCases([]);
      setIsTestsLoading(false);
    }
  }, [viewTest, isTourOpen, activeTab, testCasePaging.pageSize]);

  const tableProfilerPropsData: TableProfilerContextInterface = useMemo(() => {
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
      customMetric,
      onCustomMetricUpdate: handleUpdateCustomMetrics,
      onDateRangeChange: handleDateRangeChange,
      dateRangeObject,
      testCasePaging,
      table,
      testCaseSummary,
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
    customMetric,
    dateRangeObject,
    testCasePaging,
    table,
    testCaseSummary,
  ]);

  return (
    <TableProfilerContext.Provider value={tableProfilerPropsData}>
      {children}
      {settingModalVisible && (
        <ProfilerSettingsModal
          columns={table?.columns ?? []}
          tableId={table?.id ?? ''}
          visible={settingModalVisible}
          onVisibilityChange={handleSettingModal}
        />
      )}
    </TableProfilerContext.Provider>
  );
};

export const useTableProfiler = () => useContext(TableProfilerContext);
