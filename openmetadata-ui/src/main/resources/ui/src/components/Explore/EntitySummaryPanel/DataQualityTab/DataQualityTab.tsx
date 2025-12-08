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

import { Divider, Link } from '@mui/material';
import { Avatar, Card, Col, Row, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/ic-no-records.svg';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { Include } from '../../../../generated/type/include';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { listTestCases } from '../../../../rest/testAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { getTestCaseDetailPagePath } from '../../../../utils/RouterUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DataQualitySection from '../../../common/DataQualitySection';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../../common/Loader/Loader';
import '../../../common/OverviewSection/OverviewSection.less';
import SearchBarComponent from '../../../common/SearchBarComponent/SearchBar.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../../common/StatusBadge/StatusBadgeV2.component';
import Severity from '../../../DataQuality/IncidentManager/Severity/Severity.component';
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

type FilterStatus = 'success' | 'failed' | 'aborted';
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

      return parts.at(-1);
    }

    return null;
  };

  const getStatusBadgeType = (status: TestCaseResolutionStatusTypes) => {
    switch (status) {
      case TestCaseResolutionStatusTypes.New:
        return StatusType.Started;
      case TestCaseResolutionStatusTypes.ACK:
        return StatusType.Acknowledged;
      case TestCaseResolutionStatusTypes.Assigned:
        return StatusType.Warning;
      case TestCaseResolutionStatusTypes.Resolved:
        return StatusType.Success;
      default:
        return StatusType.Success;
    }
  };

  const getTestCaseStatusType = (status: string): StatusType => {
    const lowerStatus = status?.toLowerCase();
    if (lowerStatus === 'failed') {
      return StatusType.Failure;
    }
    if (lowerStatus === 'success') {
      return StatusType.Success;
    }
    if (lowerStatus === 'aborted') {
      return StatusType.Aborted;
    }

    return lowerStatus as StatusType;
  };

  const renderAssigneeInfo = () => {
    const assignee = incident?.testCaseResolutionStatusDetails?.assignee;
    if (!assignee) {
      return <Typography.Text className="detail-value">--</Typography.Text>;
    }

    const avatarText =
      assignee.displayName?.charAt(0) || assignee.name?.charAt(0) || 'U';
    const displayName = assignee.displayName || assignee.name || 'Unknown';

    return (
      <>
        <Avatar className="assignee-avatar" size={18}>
          {avatarText}
        </Avatar>
        <Typography.Text className="assignee-name">
          {displayName}
        </Typography.Text>
      </>
    );
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

  const severity = incident?.severity;
  const statusBadgeType = isIncidentMode
    ? getStatusBadgeType(status as TestCaseResolutionStatusTypes)
    : getTestCaseStatusType(status as string);

  return (
    <Card
      bordered={false}
      className="test-case-card"
      style={{ borderRadius: '0px' }}>
      <div className="test-case-card-content">
        <div className="test-case-header">
          <div className="test-case-title-section">
            <Link
              className="test-case-name"
              data-testid={`test-case-${testCaseName}`}
              href={getTestCaseDetailPagePath(
                testCase.fullyQualifiedName ?? ''
              )}
              target="_blank">
              {testCaseName}
            </Link>
          </div>
          <div className="test-case-status-section">
            <StatusBadgeV2
              label={status || 'Unknown'}
              showIcon={false}
              status={statusBadgeType}
            />
          </div>
        </div>

        {/* Details Section */}
        <div className="test-case-details">
          {!isIncidentMode && columnName && (
            <div className="test-case-detail-item dotted-row">
              <Typography.Text className="detail-label">
                {t('label.column')}
              </Typography.Text>
              <Typography.Text className="detail-value">
                {columnName}
              </Typography.Text>
            </div>
          )}

          {isIncidentMode && severity && (
            <div className="test-case-detail-item dotted-row">
              <Typography.Text className="detail-label">
                {t('label.severity')}
              </Typography.Text>
              <div className="detail-value">
                <Severity hasPermission={false} severity={severity} />
              </div>
            </div>
          )}

          <div className="test-case-detail-item">
            <Typography.Text className="detail-label">
              {isIncidentMode ? t('label.assignee') : t('label.incident')}
            </Typography.Text>
            {isIncidentMode ? (
              <div className="assignee-info">{renderAssigneeInfo()}</div>
            ) : (
              <Typography.Text className="detail-value">
                {testCase.incidentId ? (
                  <StatusBadgeV2
                    label="Assigned"
                    showIcon={false}
                    status={StatusType.Warning}
                  />
                ) : (
                  '--'
                )}
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
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('success');
  const [activeTab, setActiveTab] = useState<string>('data-quality');
  const [searchText, setSearchText] = useState<string>('');

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

  // Filter test cases based on active filter and search text
  const filteredTestCases = useMemo(() => {
    return testCases.filter((testCase) => {
      const status = testCase.testCaseResult?.testCaseStatus;
      const matchesStatus = status?.toLowerCase() === activeFilter;

      if (!searchText) {
        return matchesStatus;
      }

      const searchLower = searchText.toLowerCase();
      const testCaseName = testCase.name?.toLowerCase() || '';
      const testCaseDisplayName =
        testCase.displayName?.toLowerCase() ||
        testCase.fullyQualifiedName?.toLowerCase() ||
        '';

      return (
        matchesStatus &&
        (testCaseName.includes(searchLower) ||
          testCaseDisplayName.includes(searchLower))
      );
    });
  }, [testCases, activeFilter, searchText]);

  // Filter incidents based on active incident filter and search text
  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const status = incident.testCaseResolutionStatusType;
      if (!status) {
        return false;
      }

      let matchesStatus = false;
      switch (activeIncidentFilter) {
        case 'new':
          matchesStatus = status === TestCaseResolutionStatusTypes.New;

          break;
        case 'ack':
          matchesStatus = status === TestCaseResolutionStatusTypes.ACK;

          break;
        case 'assigned':
          matchesStatus = status === TestCaseResolutionStatusTypes.Assigned;

          break;
        case 'resolved':
          matchesStatus = status === TestCaseResolutionStatusTypes.Resolved;

          break;
        default:
          return false;
      }

      if (!searchText) {
        return matchesStatus;
      }

      const searchLower = searchText.toLowerCase();
      const testCaseName =
        incident.testCaseReference?.name?.toLowerCase() || '';
      const testCaseDisplayName =
        incident.testCaseReference?.displayName?.toLowerCase() || '';

      return (
        matchesStatus &&
        (testCaseName.includes(searchLower) ||
          testCaseDisplayName.includes(searchLower))
      );
    });
  }, [incidents, activeIncidentFilter, searchText]);

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

  const renderIncidentCards = () => {
    if (isIncidentsLoading) {
      return (
        <div className="flex-center p-lg">
          <Loader size="default" />
        </div>
      );
    }

    if (filteredIncidents.length > 0) {
      return (
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
      );
    }

    return (
      <div className="no-incidents">
        <Typography.Text className="text-grey-muted">
          {t('message.no-entity-found-for-name', {
            entity: t('label.incident-plural'),
            name: `${t('label.type-filed-name', {
              fieldName: startCase(activeIncidentFilter),
            })}`,
          })}
        </Typography.Text>
      </div>
    );
  };

  // Tab items configuration
  const tabItems = [
    {
      key: 'data-quality',
      label: (
        <span
          className={`tab-header-container ${
            activeTab === 'data-quality' ? 'active' : ''
          }`}>
          {t('label.data-quality')}
          <span
            className={`data-quality-tab-count ${
              activeTab === 'data-quality' ? 'active' : ''
            }`}>
            {statusCounts.total}
          </span>
        </span>
      ),
      children:
        statusCounts.total === 0 ? (
          <ErrorPlaceHolderNew
            className="text-grey-14 m-t-lg"
            icon={<AddPlaceHolderIcon height={100} width={100} />}
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography.Paragraph className="text-center p-x-md  no-data-placeholder">
              {t('message.no-data-quality-test-message')}
            </Typography.Paragraph>
          </ErrorPlaceHolderNew>
        ) : (
          <div className="data-quality-tab-content">
            <DataQualitySection
              isDataQualityTab
              activeFilter={activeFilter}
              tests={[
                { type: 'success', count: statusCounts.success },
                { type: 'aborted', count: statusCounts.aborted },
                { type: 'failed', count: statusCounts.failed },
              ]}
              totalTests={statusCounts.total}
              onEdit={() => {
                // Handle edit functionality
              }}
              onFilterChange={(filter) => {
                handleFilterChange(filter);
              }}
            />

            <div className="test-case-cards-section">
              <div className="p-b-md p-r-md">
                <SearchBarComponent
                  containerClassName="searchbar-container"
                  placeholder={t('label.search-for-type', {
                    type: t('label.test-case-plural'),
                  })}
                  searchValue={searchText}
                  typingInterval={350}
                  onSearch={setSearchText}
                />
              </div>
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
                  <Typography.Text className="no-data-placeholder">
                    {t('label.no-entity', {
                      entity: t('label.test-case-plural'),
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
      label: (
        <span
          className={`tab-header-container ${
            activeTab === 'incidents' ? 'active' : ''
          }`}>
          {t('label.incident-plural')}

          <span
            className={`data-quality-tab-count ${
              activeTab === 'incidents' ? 'active' : ''
            }`}>
            {incidentCounts.total}
          </span>
        </span>
      ),
      children:
        incidentCounts.total === 0 ? (
          <div className="m-t-lg">
            <ErrorPlaceHolderNew
              className="text-grey-14"
              icon={<AddPlaceHolderIcon height={100} width={100} />}
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <Typography.Paragraph className="text-center p-x-md  no-data-placeholder">
                {t('message.no-data-quality-test-message')}
              </Typography.Paragraph>
            </ErrorPlaceHolderNew>
          </div>
        ) : (
          <div className="incidents-tab-content">
            {/* Incidents Stats Cards */}
            <div className="incidents-stats-container">
              <div className="incidents-stats-cards-container">
                <button
                  className={`incident-stat-card new-card ${
                    activeIncidentFilter === 'new' ? 'active' : ''
                  }`}
                  type="button"
                  onClick={() => handleIncidentFilterChange('new')}>
                  <Typography.Text className="stat-count new">
                    {incidentCounts.new.toString().padStart(2, '0')}
                  </Typography.Text>
                  <Typography.Text className="stat-label new">
                    {t('label.new')}
                  </Typography.Text>
                </button>
                <Divider
                  flexItem
                  className="stat-card-vertical-divider"
                  orientation="vertical"
                  variant="middle"
                />
                <button
                  className={`incident-stat-card ack-card ${
                    activeIncidentFilter === 'ack' ? 'active' : ''
                  }`}
                  type="button"
                  onClick={() => handleIncidentFilterChange('ack')}>
                  <Typography.Text className="stat-count ack">
                    {incidentCounts.ack.toString().padStart(2, '0')}
                  </Typography.Text>
                  <Typography.Text className="stat-label ack">
                    {t('label.acknowledged')}
                  </Typography.Text>
                </button>
                <Divider
                  flexItem
                  className="stat-card-vertical-divider"
                  orientation="vertical"
                  variant="middle"
                />
                <button
                  className={`incident-stat-card assigned-card ${
                    activeIncidentFilter === 'assigned' ? 'active' : ''
                  }`}
                  type="button"
                  onClick={() => handleIncidentFilterChange('assigned')}>
                  <Typography.Text className="stat-count assigned">
                    {incidentCounts.assigned.toString().padStart(2, '0')}
                  </Typography.Text>
                  <Typography.Text className="stat-label assigned">
                    {t('label.assigned')}
                  </Typography.Text>
                </button>
              </div>
              <div>
                <button
                  className="resolved-section"
                  type="button"
                  onClick={() => handleIncidentFilterChange('resolved')}>
                  <Typography.Text className="resolved-label">
                    {t('label.-with-colon', { text: t('label.resolved') })}
                  </Typography.Text>
                  <Typography.Text className="resolved-value">
                    {incidentCounts.resolved.toString().padStart(2, '0')}
                  </Typography.Text>
                </button>
              </div>
            </div>

            {/* Test Cases Section */}
            <div className="test-cases-section">
              <div className="p-b-md">
                <SearchBarComponent
                  containerClassName="searchbar-container"
                  placeholder={t('label.search-for-type', {
                    type: t('label.incident-plural'),
                  })}
                  searchValue={searchText}
                  typingInterval={350}
                  onSearch={setSearchText}
                />
              </div>
              {/* Incident Cards */}
              <div className="incident-cards-section">
                {renderIncidentCards()}
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
