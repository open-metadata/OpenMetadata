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
import { Col, Menu, MenuProps, Row, Space } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import { DateTime } from 'luxon';
import Qs from 'qs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { ReactComponent as ColumnProfileIcon } from '../../assets/svg/column-profile.svg';
import { ReactComponent as DataQualityIcon } from '../../assets/svg/data-quality.svg';
import { ReactComponent as TableProfileIcon } from '../../assets/svg/table-profile.svg';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { mockDatasetData } from '../../constants/mockTourData.constants';
import { Table } from '../../generated/entity/data/table';
import { ProfileSampleType } from '../../generated/metadataIngestion/databaseServiceProfilerPipeline';
import { TestCase } from '../../generated/tests/testCase';
import { getLatestTableProfileByFqn } from '../../rest/tableAPI';
import { getListTestCase, ListTestCaseParams } from '../../rest/testAPI';
import { bytesToSize, getDecodedFqn } from '../../utils/StringsUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import { useTourProvider } from '../TourProvider/TourProvider';
import ColumnProfileTable from './Component/ColumnProfileTable';
import ProfilerSettingsModal from './Component/ProfilerSettingsModal';
import TableProfilerChart from './Component/TableProfilerChart';
import { QualityTab } from './QualityTab/QualityTab.component';
import {
  OverallTableSummaryType,
  TableProfilerProps,
} from './TableProfiler.interface';

const TableProfiler = ({ isTableDeleted, permissions }: TableProfilerProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { fqn: datasetFQN } = useParams<{ fqn: string }>();
  const { isTourOpen } = useTourProvider();
  const [tableProfiler, setTableProfiler] = useState<Table>();
  const [isTestsLoading, setIsTestsLoading] = useState(true);
  const [isProfilerDataLoading, setIsProfilerDataLoading] = useState(true);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [settingModalVisible, setSettingModalVisible] = useState(false);

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

  const { viewTest, viewProfiler } = useMemo(() => {
    const viewPermission = permissions.ViewAll || permissions.ViewBasic;

    return {
      viewTest: viewPermission || permissions.ViewTests,
      viewProfiler: viewPermission || permissions.ViewDataProfile,
    };
  }, [permissions]);

  const tabOptions = useMemo(
    () => [
      {
        label: t('label.table-entity-text', {
          entityText: t('label.profile'),
        }),
        key: TableProfilerTab.TABLE_PROFILE,
        disabled: !viewProfiler,
        icon: <TableProfileIcon />,
      },
      {
        label: t('label.column-entity', {
          entity: t('label.profile'),
        }),
        key: TableProfilerTab.COLUMN_PROFILE,
        disabled: !viewProfiler,
        icon: <ColumnProfileIcon />,
      },
      {
        label: t('label.data-entity', {
          entity: t('label.quality'),
        }),
        key: TableProfilerTab.DATA_QUALITY,
        disabled: !viewTest,
        icon: <DataQualityIcon />,
      },
    ],
    [viewTest, viewTest]
  );

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

  const columnTests = useMemo(() => {
    return allTestCases.filter((test) => test?.entityFQN !== datasetFQN);
  }, [allTestCases]);

  const updateActiveTab = (key: string) =>
    history.push({ search: Qs.stringify({ activeTab: key }) });

  const handleTabChange: MenuProps['onClick'] = (value) => {
    updateActiveTab(value.key);
  };

  const handleTestUpdate = useCallback((testCase?: TestCase) => {
    if (isUndefined(testCase)) {
      return;
    }
    setAllTestCases((prevTestCases) => {
      const updatedTests = prevTestCases.map((test) => {
        return testCase.id === test.id ? { ...test, ...testCase } : test;
      });

      return updatedTests;
    });
  }, []);

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
      const response = await getLatestTableProfileByFqn(decodedDatasetFQN);
      setTableProfiler(response);
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
      viewTest && !isTourOpen && !isTableProfile && isEmpty(allTestCases);

    if (fetchTest) {
      fetchAllTests();
    } else {
      setIsTestsLoading(false);
    }
  }, [viewTest, isTourOpen, isTableProfile]);

  return (
    <Row
      className="table-profiler-container h-full flex-grow"
      data-testid="table-profiler-container"
      gutter={[16, 16]}
      id="profilerDetails">
      <Col className="p-t-sm data-quality-left-panel" span={4}>
        <Menu
          className="h-full p-x-0 custom-menu"
          data-testid="profiler-tab-left-panel"
          items={tabOptions}
          mode="inline"
          selectedKeys={[activeTab ?? TableProfilerTab.TABLE_PROFILE]}
          onClick={handleTabChange}
        />
      </Col>
      <Col className="data-quality-content-panel" span={20}>
        <Space
          className="w-full h-min-full p-sm"
          direction="vertical"
          size={16}>
          {isTableProfile && (
            <TableProfilerChart
              isProfilingEnabled={!isUndefined(tableProfiler?.profile)}
              isSummaryLoading={isProfilerDataLoading}
              isTableDeleted={isTableDeleted}
              overallSummary={overallSummary}
              permissions={permissions}
              onSettingButtonClick={() => setSettingModalVisible(true)}
            />
          )}
          {isColumnProfile && (
            <ColumnProfileTable
              columnTests={columnTests}
              columns={tableProfiler?.columns ?? []}
              isLoading={isProfilerDataLoading || isTestsLoading}
              isProfilingEnabled={!isUndefined(tableProfiler?.profile)}
              isTableDeleted={isTableDeleted}
              overallSummary={overallSummary}
              permissions={permissions}
              onSettingButtonClick={() => setSettingModalVisible(true)}
            />
          )}
          {isDataQuality && (
            <QualityTab
              afterDeleteAction={fetchAllTests}
              isLoading={isTestsLoading}
              isTableDeleted={isTableDeleted}
              permissions={permissions}
              testCases={allTestCases}
              onTestCaseResultUpdate={handleTestUpdate}
              onTestUpdate={handleTestUpdate}
            />
          )}
        </Space>
      </Col>
      {settingModalVisible && (
        <ProfilerSettingsModal
          columns={tableProfiler?.columns ?? []}
          tableId={tableProfiler?.id ?? ''}
          visible={settingModalVisible}
          onVisibilityChange={handleSettingModal}
        />
      )}
    </Row>
  );
};

export default TableProfiler;
