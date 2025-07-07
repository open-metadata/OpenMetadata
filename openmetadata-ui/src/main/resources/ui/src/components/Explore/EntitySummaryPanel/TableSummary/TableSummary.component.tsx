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

import { Col, Row, Typography } from 'antd';
import { isUndefined } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { mockTablePermission } from '../../../../constants/mockTourData.constants';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { TestSummary } from '../../../../generated/tests/testCase';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { TableProfilerTab } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import './table-summary.less';
import { TableSummaryProps } from './TableSummary.interface';

function TableSummary({
  entityDetails: tableDetails,
  permissions,
}: Readonly<TableSummaryProps>) {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const isTourPage = location.pathname.includes(ROUTES.TOUR);

  const [testSuiteSummary, setTestSuiteSummary] = useState<TestSummary>();
  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  useEffect(() => {
    setTablePermissions(permissions as OperationPermission);
  }, [permissions]);
  // Since we are showing test cases summary in the table summary panel, we are using ViewTests permission
  const viewTestCasesPermission = useMemo(
    () => tablePermissions?.ViewAll || tablePermissions?.ViewTests,
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

  const handleDqRedirection = () => {
    navigate({
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        tableDetails.fullyQualifiedName ?? '',
        EntityTabs.PROFILER
      ),
      search: QueryString.stringify({
        activeTab: TableProfilerTab.DATA_QUALITY,
      }),
    });
  };

  const testCasesSummary = useMemo(() => {
    if (!viewTestCasesPermission) {
      return (
        <Typography.Text
          className="text-grey-body"
          data-testid="no-permissions-to-view">
          {t('message.no-permission-to-view')}
        </Typography.Text>
      );
    }

    return isUndefined(testSuiteSummary) ? (
      <Typography.Text
        className="text-sm no-data-chip-placeholder"
        data-testid="no-profiler-enabled-message">
        {t('message.no-data-quality-enabled-summary-message')}
      </Typography.Text>
    ) : (
      <div className="d-flex justify-between gap-3">
        <div
          className="profiler-item green"
          data-testid="test-passed"
          role="button"
          onClick={handleDqRedirection}>
          <div className="text-xs">{`${t('label.test-plural')} ${t(
            'label.passed'
          )}`}</div>
          <div
            className="font-semibold text-lg"
            data-testid="test-passed-value">
            {testSuiteSummary?.success ?? 0}
          </div>
        </div>
        <div
          className="profiler-item amber"
          data-testid="test-aborted"
          role="button"
          onClick={handleDqRedirection}>
          <div className="text-xs">{`${t('label.test-plural')} ${t(
            'label.aborted'
          )}`}</div>
          <div
            className="font-semibold text-lg"
            data-testid="test-aborted-value">
            {testSuiteSummary?.aborted ?? 0}
          </div>
        </div>
        <div
          className="profiler-item red"
          data-testid="test-failed"
          role="button"
          onClick={handleDqRedirection}>
          <div className="text-xs">{`${t('label.test-plural')} ${t(
            'label.failed'
          )}`}</div>
          <div
            className="font-semibold text-lg"
            data-testid="test-failed-value">
            {testSuiteSummary?.failed ?? 0}
          </div>
        </div>
      </div>
    );
  }, [tableDetails, testSuiteSummary, viewTestCasesPermission]);

  const init = useCallback(async () => {
    if (tableDetails.id && !isTourPage) {
      const shouldFetchTestCaseData =
        !isTableDeleted &&
        tableDetails.service?.type === 'databaseService' &&
        (permissions?.ViewAll || permissions?.ViewTests);
      if (shouldFetchTestCaseData) {
        fetchAllTests();
      }
    } else {
      setTablePermissions(mockTablePermission as OperationPermission);
    }
  }, [tableDetails, isTourPage, isTableDeleted, fetchAllTests, permissions]);

  useEffect(() => {
    init();
  }, [tableDetails.id, permissions]);

  return (
    <Row className="p-md border-radius-card summary-panel-card" gutter={[0, 8]}>
      <Col span={24}>
        <Typography.Text
          className="summary-panel-section-title"
          data-testid="profiler-header">
          {t('label.data-quality')}
        </Typography.Text>
      </Col>
      <Col span={24}>{testCasesSummary}</Col>
    </Row>
  );
}

export default TableSummary;
