/*
 *  Copyright 2022 Collate.
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

import { Col, Divider, Row, Typography } from 'antd';
import { get, isEmpty, isUndefined } from 'lodash';
import {
  default as React,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../../constants/constants';
import { mockTablePermission } from '../../../../constants/mockTourData.constants';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { Table } from '../../../../generated/entity/data/table';
import { TestSummary } from '../../../../generated/tests/testCase';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getLatestTableProfileByFqn } from '../../../../rest/tableAPI';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import {
  getFormattedEntityData,
  getSortedTagsWithHighlight,
} from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';
import './table-summary.less';
import {
  TableProfileDetails,
  TableSummaryProps,
} from './TableSummary.interface';

function TableSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
  highlights,
}: TableSummaryProps) {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const isTourPage = location.pathname.includes(ROUTES.TOUR);
  const { getEntityPermission } = usePermissionProvider();

  const [profileData, setProfileData] = useState<TableProfileDetails>();
  const [incidentCount, setIncidentCount] = useState(0);
  const [testSuiteSummary, setTestSuiteSummary] = useState<TestSummary>();
  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const tableDetails: Table = useMemo(
    () => ({ ...entityDetails, ...profileData }),
    [entityDetails, profileData]
  );

  const viewProfilerPermission = useMemo(
    () => tablePermissions.ViewDataProfile || tablePermissions.ViewAll,
    [tablePermissions]
  );

  const isTableDeleted = useMemo(() => tableDetails.deleted, [tableDetails]);

  const fetchAllTests = async () => {
    if (tableDetails?.testSuite?.id) {
      try {
        const res = await getTestCaseExecutionSummary(
          tableDetails.testSuite.id
        );

        setTestSuiteSummary(res);
      } catch (error) {
        // Error
      }
    }
  };

  const fetchIncidentCount = async () => {
    if (tableDetails?.fullyQualifiedName) {
      try {
        const { paging } = await getListTestCaseIncidentStatus({
          limit: 0,
          latest: true,
          originEntityFQN: tableDetails?.fullyQualifiedName,
          startTs: getEpochMillisForPastDays(
            PROFILER_FILTER_RANGE.last30days.days
          ),
          endTs: getCurrentMillis(),
        });

        setIncidentCount(paging.total);
      } catch (error) {
        setIncidentCount(0);
      }
    }
  };

  const fetchProfilerData = useCallback(async () => {
    try {
      const { profile, tableConstraints } = await getLatestTableProfileByFqn(
        tableDetails?.fullyQualifiedName ?? ''
      );
      setProfileData({ profile, tableConstraints });
    } catch (error) {
      // Error
    }
  }, [tableDetails]);

  const profilerSummary = useMemo(() => {
    if (!viewProfilerPermission) {
      return (
        <Typography.Text
          className="text-grey-body"
          data-testid="no-permissions-to-view">
          {t('message.no-permission-to-view')}
        </Typography.Text>
      );
    }

    return isUndefined(tableDetails.profile) ? (
      <Typography.Text
        className="text-grey-body"
        data-testid="no-profiler-enabled-message">
        {t('message.no-profiler-enabled-summary-message')}
      </Typography.Text>
    ) : (
      <div className="d-flex justify-between">
        <div className="profiler-item green" data-testid="test-passed">
          <div
            className="font-semibold text-lg"
            data-testid="test-passed-value">
            {testSuiteSummary?.success ?? 0}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.passed')}`}</div>
        </div>
        <div className="profiler-item amber" data-testid="test-aborted">
          <div
            className="font-semibold text-lg"
            data-testid="test-aborted-value">
            {testSuiteSummary?.aborted ?? 0}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.aborted')}`}</div>
        </div>
        <div className="profiler-item red" data-testid="test-failed">
          <div
            className="font-semibold text-lg"
            data-testid="test-failed-value">
            {testSuiteSummary?.failed ?? 0}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.failed')}`}</div>
        </div>
      </div>
    );
  }, [tableDetails, testSuiteSummary, viewProfilerPermission]);

  const entityInfo = useMemo(
    () =>
      getEntityOverview(ExplorePageTabs.TABLES, tableDetails, {
        incidentCount,
      }),
    [tableDetails, incidentCount]
  );

  const formattedColumnsData: BasicEntityInfo[] = useMemo(
    () =>
      getFormattedEntityData(
        SummaryEntityType.COLUMN,
        tableDetails.columns,
        highlights,
        tableDetails.tableConstraints
      ),
    [tableDetails]
  );

  const init = useCallback(async () => {
    if (tableDetails.id && !isTourPage) {
      const tablePermission = await getEntityPermission(
        ResourceEntity.TABLE,
        tableDetails.id
      );
      setTablePermissions(tablePermission);
      const shouldFetchProfilerData =
        !isTableDeleted &&
        tableDetails.service?.type === 'databaseService' &&
        !isTourPage &&
        tablePermission;

      if (shouldFetchProfilerData) {
        fetchProfilerData();
        fetchAllTests();
        fetchIncidentCount();
      }
    } else {
      setTablePermissions(mockTablePermission as OperationPermission);
    }
  }, [
    tableDetails,
    isTourPage,
    isTableDeleted,
    fetchProfilerData,
    fetchAllTests,
    getEntityPermission,
  ]);

  useEffect(() => {
    init();
  }, [tableDetails.id]);

  return (
    <SummaryPanelSkeleton loading={isLoading || isEmpty(tableDetails)}>
      <>
        <Row
          className="m-md m-t-0 p-md border-radius-card"
          gutter={[0, 4]}
          style={{ background: '#f5f5f5' }}>
          <Col span={24}>
            <CommonEntitySummaryInfo
              componentType={componentType}
              entityInfo={entityInfo}
            />
          </Col>
        </Row>

        <Divider className="m-y-xs" />

        <Row
          className="m-md p-md border-radius-card"
          gutter={[0, 8]}
          style={{ background: '#f5f5f5' }}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="profiler-header">
              {t('label.profiler-amp-data-quality')}
            </Typography.Text>
          </Col>
          <Col span={24}>{profilerSummary}</Col>
        </Row>

        <Divider className="m-y-xs" />

        <SummaryTagsDescription
          entityDetail={tableDetails}
          tags={
            tags ??
            getSortedTagsWithHighlight(
              tableDetails.tags,
              get(highlights, 'tag.name')
            )
          }
        />
        <Divider className="m-y-xs" />

        <Row
          className="m-md p-md border-radius-card"
          gutter={[0, 8]}
          style={{ background: '#f5f5f5' }}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="schema-header">
              {t('label.schema')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <SummaryList
              entityType={SummaryEntityType.COLUMN}
              formattedEntityData={formattedColumnsData}
            />
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
}

export default TableSummary;
