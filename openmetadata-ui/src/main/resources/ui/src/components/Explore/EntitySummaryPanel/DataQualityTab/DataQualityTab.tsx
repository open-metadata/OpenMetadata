/*
 *  Copyright 2025 Collate.
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

import { Avatar, Button, Card, Col, Row, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DATA_QUALITY_PROFILER_DOCS } from '../../../../constants/docs.constants';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { Include } from '../../../../generated/type/include';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { listTestCases } from '../../../../rest/testAPI';
import { Transi18next } from '../../../../utils/CommonUtils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DataQualitySection from '../../../common/DataQualitySection';
import Loader from '../../../common/Loader/Loader';
import '../../../common/OverviewSection/OverviewSection.less';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../../common/StatusBadge/StatusBadgeV2.component';
import './DataQualityTab.less';

interface DataQualityTabProps {
  entityFQN: string;
  entityType: string;
}

interface TestCaseStatusCounts {
  success: number;
  failed: number;
  aborted: number;
  ack: number;
  total: number;
}

interface IncidentStatusCounts {
  new: number;
  assigned: number;
  resolved: number;
  ack: number;
  total: number;
}

type FilterStatus = 'all' | 'success' | 'failed' | 'aborted';
type IncidentFilterStatus = 'new' | 'ack' | 'assigned' | 'resolved';

interface TestCaseCardProps {
  testCase: TestCase;
  incident?: TestCaseResolutionStatus;
}

const TestCaseCard: React.FC<TestCaseCardProps> = ({ testCase, incident }) => {
  const { t } = useTranslation();

  const getColumnName = (entityLink: string) => {
    if (entityLink.includes('::columns::')) {
      const parts = entityLink.split('::columns::');

      return parts[parts.length - 1];
    }

    return null;
  };

  const getStatusBadgeType = (status: TestCaseResolutionStatusTypes) => {
    switch (status) {
      case TestCaseResolutionStatusTypes.New:
        return StatusType.Started;
      case TestCaseResolutionStatusTypes.Assigned:
        return StatusType.Warning;
      case TestCaseResolutionStatusTypes.Resolved:
        return StatusType.Success;
      default:
        return StatusType.Success;
    }
  };

  const getSeverityText = (severity: number | string) => {
    return `SEVERITY - ${severity}`;
  };

  // If incident is provided, use incident data; otherwise use test case data
  const isIncidentMode = !!incident;

  const columnName = getColumnName(testCase.entityLink || '');
  const status = isIncidentMode
    ? incident?.testCaseResolutionStatusType
    : testCase.testCaseResult?.testCaseStatus;

  const testCaseName = isIncidentMode
    ? incident?.testCaseReference?.displayName ||
      incident?.testCaseReference?.name ||
      'Unknown Test Case'
    : testCase.name;

  const assignee = incident?.testCaseResolutionStatusDetails?.assignee;
  const severity = incident?.severity;

  return (
    <Card
      bordered={false}
      className="test-case-card"
      style={{ borderRadius: '0px' }}>
      <div className="test-case-card-content">
        {/* Header Section */}
        <div className="test-case-header">
          <div className="test-case-title-section">
            <Typography.Text strong className="test-case-name">
              {testCaseName}
            </Typography.Text>
          </div>
          <div className="test-case-status-section">
            <StatusBadgeV2
              label={status || 'Unknown'}
              status={
                isIncidentMode
                  ? getStatusBadgeType(status as TestCaseResolutionStatusTypes)
                  : status?.toLowerCase() === 'failed'
                  ? StatusType.Failure
                  : status?.toLowerCase() === 'success'
                  ? StatusType.Success
                  : status?.toLowerCase() === 'aborted'
                  ? StatusType.Aborted
                  : (status?.toLowerCase() as StatusType)
              }
            />
          </div>
        </div>

        {/* Details Section */}
        <div className="test-case-details">
          {!isIncidentMode && columnName && (
            <div className="test-case-detail-item">
              <Typography.Text className="detail-label">
                {t('label.column')}
              </Typography.Text>
              <Typography.Text className="detail-value">
                {columnName}
              </Typography.Text>
            </div>
          )}

          {isIncidentMode && severity && (
            <div className="test-case-detail-item">
              <Typography.Text className="detail-label">
                {t('label.severity')}
              </Typography.Text>
              <Typography.Text className="detail-value">
                {getSeverityText(severity)}
              </Typography.Text>
            </div>
          )}

          <div className="test-case-detail-item">
            <Typography.Text className="detail-label">
              {isIncidentMode ? t('label.assignee') : t('label.incident')}
            </Typography.Text>
            {isIncidentMode ? (
              <div className="assignee-info">
                {assignee ? (
                  <>
                    <Avatar className="assignee-avatar" size="small">
                      {assignee.displayName?.charAt(0) ||
                        assignee.name?.charAt(0) ||
                        'U'}
                    </Avatar>
                    <Typography.Text className="assignee-name">
                      {assignee.displayName || assignee.name || 'Unknown'}
                    </Typography.Text>
                  </>
                ) : (
                  <Typography.Text className="detail-value">--</Typography.Text>
                )}
              </div>
            ) : (
              <Typography.Text className="detail-value">
                {testCase.incidentId ? 'ASSIGNED' : '--'}
              </Typography.Text>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

const DataQualityTab: React.FC<DataQualityTabProps> = ({ entityFQN }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [statusCounts, setStatusCounts] = useState<TestCaseStatusCounts>({
    success: 0,
    failed: 0,
    aborted: 0,
    ack: 0,
    total: 0,
  });
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [activeTab, setActiveTab] = useState<string>('data-quality');

  // Incident-related state
  const [incidents, setIncidents] = useState<TestCaseResolutionStatus[]>([]);
  const [incidentCounts, setIncidentCounts] = useState<IncidentStatusCounts>({
    new: 0,
    assigned: 0,
    resolved: 0,
    total: 0,
    ack: 0,
  });
  const [activeIncidentFilter, setActiveIncidentFilter] =
    useState<IncidentFilterStatus>('new');
  const [isIncidentsLoading, setIsIncidentsLoading] = useState<boolean>(false);

  const fetchTestCases = async () => {
    if (!entityFQN) {
      setIsLoading(false);

      return;
    }

    try {
      setIsLoading(true);
      const entityLink = generateEntityLink(entityFQN);

      const response = await listTestCases({
        entityLink,
        includeAllTests: true,
        limit: 100, // Get more test cases to ensure accurate counts
        fields: ['testCaseResult', 'incidentId'],
      });

      setTestCases(response.data || []);

      // Calculate status counts
      const counts = (response.data || []).reduce(
        (acc, testCase) => {
          const status = testCase.testCaseResult?.testCaseStatus;
          if (status) {
            switch (status) {
              case TestCaseStatus.Success:
                acc.success++;

                break;
              case TestCaseStatus.Failed:
                acc.failed++;

                break;
              case TestCaseStatus.Aborted:
                acc.aborted++;

                break;
            }
            acc.total++;
          }

          return acc;
        },
        { success: 0, failed: 0, aborted: 0, ack: 0, total: 0 }
      );

      setStatusCounts(counts);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setTestCases([]);
      setStatusCounts({ success: 0, failed: 0, aborted: 0, ack: 0, total: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIncidents = async () => {
    if (!entityFQN) {
      setIsIncidentsLoading(false);

      return;
    }

    try {
      setIsIncidentsLoading(true);

      const startTs = getEpochMillisForPastDays(
        PROFILER_FILTER_RANGE.last30days.days
      );
      const endTs = getCurrentMillis();

      const response = await getListTestCaseIncidentStatus({
        latest: true,
        include: Include.NonDeleted,
        originEntityFQN: entityFQN,
        startTs,
        endTs,
        limit: 100,
      });

      setIncidents(response.data || []);

      // Calculate incident status counts
      const counts = (response.data || []).reduce(
        (acc, incident) => {
          const status = incident.testCaseResolutionStatusType;

          if (status) {
            switch (status) {
              case TestCaseResolutionStatusTypes.New:
                acc.new++;

                break;
              case TestCaseResolutionStatusTypes.Assigned:
                acc.assigned++;

                break;
              case TestCaseResolutionStatusTypes.Resolved:
                acc.resolved++;

                break;
              case TestCaseResolutionStatusTypes.ACK:
                acc.ack++;

                break;
            }
            acc.total++;
          }

          return acc;
        },
        {
          new: 0,
          assigned: 0,
          resolved: 0,
          ack: 0,
          total: 0,
        }
      );

      setIncidentCounts(counts);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIncidents([]);
      setIncidentCounts({
        new: 0,
        assigned: 0,
        resolved: 0,
        ack: 0,
        total: 0,
      });
    } finally {
      setIsIncidentsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestCases();
    fetchIncidents();
  }, [entityFQN]);

  // Filter test cases based on active filter
  const filteredTestCases = testCases.filter((testCase) => {
    if (activeFilter === 'all') {
      return true;
    }
    const status = testCase.testCaseResult?.testCaseStatus;

    return status?.toLowerCase() === activeFilter;
  });

  // Filter incidents based on active incident filter
  const filteredIncidents = incidents.filter((incident) => {
    const status = incident.testCaseResolutionStatusType;
    if (!status) {
      return false;
    }

    switch (activeIncidentFilter) {
      case 'new':
        return status === TestCaseResolutionStatusTypes.New;
      case 'ack':
        return status === TestCaseResolutionStatusTypes.ACK;
      case 'assigned':
        return status === TestCaseResolutionStatusTypes.Assigned;
      case 'resolved':
        return status === TestCaseResolutionStatusTypes.Resolved;
      default:
        return false;
    }
  });

  const handleFilterChange = (filter: FilterStatus) => {
    setActiveFilter(filter);
  };

  const handleIncidentFilterChange = (filter: IncidentFilterStatus) => {
    setActiveIncidentFilter(filter);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  // Convert incident to test case format for reuse
  const convertIncidentToTestCase = (
    incident: TestCaseResolutionStatus
  ): TestCase => {
    return {
      id: incident.id || '',
      name:
        incident.testCaseReference?.displayName ||
        incident.testCaseReference?.name ||
        'Unknown Test Case',
      fullyQualifiedName: incident.testCaseReference?.fullyQualifiedName || '',
      entityLink: incident.testCaseReference?.fullyQualifiedName || '',
      testCaseResult: {
        testCaseStatus: incident.testCaseResolutionStatusType as string,
        timestamp: incident.timestamp || Date.now(),
      },
      incidentId: incident.id,
    } as TestCase;
  };

  // Tab items configuration
  const tabItems = [
    {
      key: 'data-quality',
      label: t('label.data-quality'),
      children: (
        <div className="data-quality-tab-content">
          <DataQualitySection
            isDataQualityTab
            tests={[
              { type: 'success', count: statusCounts.success },
              { type: 'aborted', count: statusCounts.aborted },
              { type: 'failed', count: statusCounts.failed },
            ]}
            totalTests={statusCounts.total}
            onEdit={() => {
              // Handle edit functionality
            }}
          />
          <Typography.Text ellipsis className="test-title">
            {t('label.test-case-plural')}
          </Typography.Text>
          <Row className="m-b-sm gap-1">
            <Col>
              <Button
                className={`filter-button all ${
                  activeFilter === 'all' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleFilterChange('all')}>
                {t('label.all')}
                <span
                  className={`test-case-count ${
                    activeFilter === 'all' ? 'active' : ''
                  }`}>
                  {statusCounts.total}
                </span>
              </Button>
            </Col>
            <Col>
              <Button
                className={`filter-button success ${
                  activeFilter === 'success' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleFilterChange('success')}>
                {t('label.success')}
                <span
                  className={`test-case-count ${
                    activeFilter === 'success' ? 'active' : ''
                  }`}>
                  {statusCounts.success}
                </span>
              </Button>
            </Col>

            <Col>
              <Button
                className={`filter-button aborted ${
                  activeFilter === 'aborted' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleFilterChange('aborted')}>
                {t('label.aborted')}
                <span
                  className={`test-case-count ${
                    activeFilter === 'aborted' ? 'active' : ''
                  }`}>
                  {statusCounts.aborted}
                </span>
              </Button>
            </Col>
            <Col>
              <Button
                className={`filter-button failed ${
                  activeFilter === 'failed' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleFilterChange('failed')}>
                {t('label.failed')}
                <span
                  className={`test-case-count ${
                    activeFilter === 'failed' ? 'active' : ''
                  }`}>
                  {statusCounts.failed}
                </span>
              </Button>
            </Col>
          </Row>

          {/* Test Case Cards */}
          <div className="test-case-cards-section">
            {filteredTestCases.length > 0 ? (
              <Row gutter={[0, 12]} style={{ marginLeft: '-16px' }}>
                {filteredTestCases.map((testCase) => (
                  <Col key={testCase.id} span={24}>
                    <TestCaseCard testCase={testCase} />
                  </Col>
                ))}
              </Row>
            ) : (
              <div className="no-test-cases">
                <Typography.Text className="text-grey-muted">
                  {t('message.no-test-cases-for-status', {
                    status: activeFilter,
                  })}
                </Typography.Text>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'incidents',
      label: t('label.incident-plural'),
      children: (
        <div className="incidents-tab-content">
          {/* Incidents Summary Section */}
          <div className="incidents-summary-section">
            <Typography.Text className="incident-test-title d-inline-block">
              {t('label.incident-plural')}
            </Typography.Text>

            <div className="overview-section gap-0">
              <div className="overview-row  m-b-sm">
                <span className="overview-label" data-testid="new-label">
                  {t('label.new')}
                </span>
                <span
                  className="overview-value text-grey-body"
                  data-testid="new-value">
                  {incidentCounts.new}
                </span>
              </div>
              <div className="overview-row  m-b-sm">
                <span className="overview-label" data-testid="ack-label">
                  {t('label.acknowledged')}
                </span>
                <span
                  className="overview-value text-grey-body"
                  data-testid="ack-value">
                  {incidentCounts.ack}
                </span>
              </div>
              <div className="overview-row  m-b-sm">
                <span className="overview-label" data-testid="assigned-label">
                  {t('label.assigned')}
                </span>
                <span
                  className="overview-value text-grey-body"
                  data-testid="assigned-value">
                  {incidentCounts.assigned}
                </span>
              </div>
              <div className="overview-row">
                <span className="overview-label" data-testid="resolved-label">
                  {t('label.resolved')}
                </span>
                <span
                  className="overview-value text-grey-body"
                  data-testid="resolved-value">
                  {incidentCounts.resolved}
                </span>
              </div>
            </div>
          </div>

          {/* Test Cases Section */}
          <div className="test-cases-section">
            <Typography.Text ellipsis className="incident-test-title">
              {t('label.incident-plural')}
            </Typography.Text>

            <div className="incident-filter-buttons-container">
              <Button
                className={`incident-filter-button ${
                  activeIncidentFilter === 'new' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleIncidentFilterChange('new')}>
                {t('label.new')}
                <span
                  className={`incident-test-case-count ${
                    activeIncidentFilter === 'new' ? 'active' : ''
                  }`}>
                  {incidentCounts.new}
                </span>
              </Button>

              <Button
                className={`incident-filter-button ${
                  activeIncidentFilter === 'ack' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleIncidentFilterChange('ack')}>
                {t('label.ack')}
                <span
                  className={`incident-test-case-count ${
                    activeIncidentFilter === 'ack' ? 'active' : ''
                  }`}>
                  {incidentCounts.ack}
                </span>
              </Button>
              <Button
                className={`incident-filter-button ${
                  activeIncidentFilter === 'assigned' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleIncidentFilterChange('assigned')}>
                {t('label.assigned')}
                <span
                  className={`incident-test-case-count ${
                    activeIncidentFilter === 'assigned' ? 'active' : ''
                  }`}>
                  {incidentCounts.assigned}
                </span>
              </Button>
              <Button
                className={`incident-filter-button ${
                  activeIncidentFilter === 'resolved' ? 'active' : ''
                }`}
                size="small"
                onClick={() => handleIncidentFilterChange('resolved')}>
                {t('label.resolved')}
                <span
                  className={`incident-test-case-count ${
                    activeIncidentFilter === 'resolved' ? 'active' : ''
                  }`}>
                  {incidentCounts.resolved}
                </span>
              </Button>
            </div>

            {/* Incident Cards */}
            <div className="incident-cards-section">
              {isIncidentsLoading ? (
                <div className="flex-center p-lg">
                  <Loader size="default" />
                </div>
              ) : filteredIncidents.length > 0 ? (
                <Row gutter={[0, 12]}>
                  {filteredIncidents.map((incident) => (
                    <Col key={incident.id} span={24}>
                      <TestCaseCard
                        incident={incident}
                        testCase={convertIncidentToTestCase(incident)}
                      />
                    </Col>
                  ))}
                </Row>
              ) : (
                <div className="no-incidents">
                  <Typography.Text className="text-grey-muted">
                    {t('message.no-incidents-for-status', {
                      status: activeIncidentFilter,
                    })}
                  </Typography.Text>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="data-quality-tab-container p-md">
        <div>
          <Loader />
        </div>
      </div>
    );
  }

  if (statusCounts.total === 0) {
    return (
      <div className="data-quality-tab-container p-md">
        <div className="text-center text-grey-muted">
          <Transi18next
            i18nKey="message.no-data-quality-test-case"
            renderElement={
              <a
                href={DATA_QUALITY_PROFILER_DOCS}
                rel="noreferrer"
                target="_blank"
                title="Data Quality Profiler Documentation"
              />
            }
            values={{
              explore: t('message.explore-our-guide-here'),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="data-quality-tab-container">
      <Tabs
        activeKey={activeTab}
        className="data-quality-tabs"
        items={tabItems}
        onChange={handleTabChange}
      />
    </div>
  );
};

export default DataQualityTab;
