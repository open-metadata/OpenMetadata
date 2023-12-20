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
import { useLocation } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { mockTablePermission } from '../../../../constants/mockTourData.constants';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { Table, TestSummary } from '../../../../generated/entity/data/table';
import {
  getLatestTableProfileByFqn,
  getTableDetailsByFQN,
} from '../../../../rest/tableAPI';
import { formTwoDigitNmber as formTwoDigitNumber } from '../../../../utils/CommonUtils';
import {
  getFormattedEntityData,
  getSortedTagsWithHighlight,
} from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { getEncodedFqn } from '../../../../utils/StringsUtils';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { usePermissionProvider } from '../../../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../PermissionProvider/PermissionProvider.interface';
import SummaryPanelSkeleton from '../../../Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
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
  const location = useLocation();
  const isTourPage = location.pathname.includes(ROUTES.TOUR);
  const { getEntityPermission } = usePermissionProvider();

  const [profileData, setProfileData] = useState<TableProfileDetails>();
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
    try {
      const res = await getTableDetailsByFQN(
        getEncodedFqn(tableDetails.fullyQualifiedName ?? ''),
        'testSuite'
      );

      if (res?.testSuite?.summary) {
        setTestSuiteSummary(res?.testSuite?.summary);
      }
    } catch (error) {
      // Error
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
            {formTwoDigitNumber(testSuiteSummary?.success ?? 0)}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.passed')}`}</div>
        </div>
        <div className="profiler-item amber" data-testid="test-aborted">
          <div
            className="font-semibold text-lg"
            data-testid="test-aborted-value">
            {formTwoDigitNumber(testSuiteSummary?.aborted ?? 0)}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.aborted')}`}</div>
        </div>
        <div className="profiler-item red" data-testid="test-failed">
          <div
            className="font-semibold text-lg"
            data-testid="test-failed-value">
            {formTwoDigitNumber(testSuiteSummary?.failed ?? 0)}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.failed')}`}</div>
        </div>
      </div>
    );
  }, [tableDetails, testSuiteSummary, viewProfilerPermission]);

  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.TABLES, tableDetails),
    [tableDetails]
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
        <Row className="m-md m-t-0" gutter={[0, 4]}>
          <Col span={24}>
            <CommonEntitySummaryInfo
              componentType={componentType}
              entityInfo={entityInfo}
            />
          </Col>
        </Row>

        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
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
            getSortedTagsWithHighlight({
              tags: tableDetails.tags,
              sortTagsBasedOnGivenTagFQNs: get(
                highlights,
                'tag.name',
                [] as string[]
              ),
            }) ??
            []
          }
        />
        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
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
