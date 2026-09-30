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

import {
  Box,
  Card,
  Divider,
  Owner,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/ic-no-records.svg';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import {
  ERROR_PLACEHOLDER_TYPE,
  SORT_ORDER,
} from '../../../../enums/common.enum';
import { TestCaseType } from '../../../../enums/TestSuite.enum';
import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { Include } from '../../../../generated/type/include';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getListTestCaseBySearch } from '../../../../rest/testAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { getColumnNameFromEntityLink } from '../../../../utils/EntityPureUtils';
import { getTableFQNFromColumnFQN } from '../../../../utils/FqnUtils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { generateEntityLink } from '../../../../utils/TablePureUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DataQualitySection from '../../../common/DataQualitySection/DataQualitySection';
import ErrorPlaceHolderNew from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import Loader from '../../../common/Loader/Loader';
import '../../../common/OverviewSection/OverviewSection.less';
import SearchBarComponent from '../../../common/SearchBarComponent/SearchBar.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../../common/StatusBadge/StatusBadgeV2.component';
import Severity from '../../../DataQuality/IncidentManager/Severity/Severity.component';
import {
  DataQualityTabProps,
  DetailItemProps,
  FilterStatus,
  IncidentFilterStatus,
  IncidentStatusCounts,
  TestCaseCardProps,
  TestCaseStatusCounts,
} from './DataQualityTab.interface';
import './DataQualityTab.less';

const DATA_QUALITY_TAB_KEY = 'data-quality';

const DetailItem: React.FC<DetailItemProps> = ({
  label,
  value,
  showDottedBorder = false,
}) => (
  <>
    <div className="test-case-detail-item tw:flex tw:items-center tw:gap-1">
      <Typography className="tw:min-w-15" color="secondary" size="text-xs">
        {`${label}:`}
      </Typography>
      <div>{value}</div>
    </div>
    {showDottedBorder && <Divider dashed />}
  </>
);

const TestCaseCard: React.FC<TestCaseCardProps> = ({ testCase, incident }) => {
  const { t } = useTranslation();

  const getColumnName = (entityLink: string) => {
    const isColumn = entityLink.includes('::columns::');
    if (isColumn) {
      const name = getColumnNameFromEntityLink(entityLink ?? '');

      return name;
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

  // Build detail items array for cleaner rendering
  const detailItems = useMemo(() => {
    if (isIncidentMode) {
      // Incident mode: show severity and assignee
      const assignee = incident?.testCaseResolutionStatusDetails?.assignee;

      return [
        ...(severity
          ? [
              {
                label: t('label.severity'),
                value: <Severity hasPermission={false} severity={severity} />,
                showDottedBorder: true, // Always show border before assignee
              },
            ]
          : []),
        {
          label: t('label.assignee'),
          value: (
            <div className="tw:ml-1">
              <Owner
                owners={assignee ? [assignee] : []}
                placeHolder={t('label.no-entity', {
                  entity: t('label.assignee'),
                })}
              />
            </div>
          ),
          showDottedBorder: false, // Last item, no border
        },
      ];
    }

    // Test case mode: show test type and column name if applicable
    return [
      ...(columnName
        ? [
            {
              label: t('label.test-type'),
              value: t('label.column'),
              showDottedBorder: true, // Always show border before column name
            },
            {
              label: t('label.column-name'),
              value: columnName,
              showDottedBorder: !!testCase.incidentId, // Show border only if incident follows
            },
          ]
        : [
            {
              label: t('label.test-type'),
              value: t('label.table'),
              showDottedBorder: !!testCase.incidentId, // Show border only if incident follows
            },
          ]),
      ...(testCase.incidentId
        ? [
            {
              label: t('label.incident'),
              value: (
                <StatusBadgeV2
                  label="Assigned"
                  showIcon={false}
                  status={StatusType.Warning}
                />
              ),
              showDottedBorder: false, // Last item, no border
            },
          ]
        : []),
    ];
  }, [isIncidentMode, columnName, testCase.incidentId, severity, incident, t]);

  return (
    <Card className="test-case-card tw:mx-4" size="sm">
      <Card.Header
        extra={
          <StatusBadgeV2
            className="test-case-status-section"
            label={status || 'Unknown'}
            showIcon={false}
            status={statusBadgeType}
          />
        }
        title={
          <Link
            className="test-case-name tw:line-clamp-2 tw:break-words"
            data-testid={`test-case-${testCaseName}`}
            to={observabilityRouterClassBase.getTestCaseDetailPagePath(
              testCase.fullyQualifiedName ?? ''
            )}>
            {testCaseName}
          </Link>
        }
      />
      <Card.Content className="tw:flex tw:flex-col tw:gap-2 tw:text-xs">
        {detailItems.map((item) => (
          <DetailItem
            key={item.label}
            label={item.label}
            showDottedBorder={item.showDottedBorder}
            value={item.value}
          />
        ))}
      </Card.Content>
    </Card>
  );
};

const INCIDENT_FILTER_STATUS_MAP: Record<
  IncidentFilterStatus,
  TestCaseResolutionStatusTypes
> = {
  new: TestCaseResolutionStatusTypes.New,
  ack: TestCaseResolutionStatusTypes.ACK,
  assigned: TestCaseResolutionStatusTypes.Assigned,
  resolved: TestCaseResolutionStatusTypes.Resolved,
};

const DataQualityTab: React.FC<DataQualityTabProps> = ({
  entityFQN,
  isColumnDetailPanel = false,
  hasViewTests = true,
}) => {
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
  const [activeTab, setActiveTab] = useState<string>(DATA_QUALITY_TAB_KEY);
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

  const fetchTestCases = async (searchQuery: string = '') => {
    if (!entityFQN) {
      setIsLoading(false);

      return;
    }

    try {
      setIsLoading(true);
      const entityLink = generateEntityLink(entityFQN);

      const response = await getListTestCaseBySearch({
        entityLink,
        q: searchQuery || undefined,
        includeAllTests: true,
        limit: 50,
        fields: 'testCaseResult,incidentId',
        include: Include.NonDeleted,
        sortType: SORT_ORDER.DESC,
        sortField: 'testCaseResult.timestamp',
        testCaseType: TestCaseType.all,
      });

      setTestCases(response.data || []);

      if (!searchQuery) {
        // Calculate status counts only when there is no search query
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
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
      setTestCases([]);
      if (!searchQuery) {
        setStatusCounts({
          success: 0,
          failed: 0,
          aborted: 0,
          ack: 0,
          total: 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIncidents = useCallback(
    async (currentTestCases?: TestCase[]) => {
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

        const originFQN = isColumnDetailPanel
          ? getTableFQNFromColumnFQN(entityFQN)
          : entityFQN;

        const response = await getListTestCaseIncidentStatus({
          latest: true,
          include: Include.NonDeleted,
          originEntityFQN: originFQN,
          startTs,
          endTs,
          limit: 100,
        });

        let allIncidents = response.data || [];

        if (
          isColumnDetailPanel &&
          currentTestCases &&
          currentTestCases.length > 0
        ) {
          const testCaseFQNSet = new Set(
            currentTestCases.map((testCase) => testCase.fullyQualifiedName)
          );
          allIncidents = allIncidents.filter(
            (incident) =>
              incident.testCaseReference?.fullyQualifiedName &&
              testCaseFQNSet.has(incident.testCaseReference.fullyQualifiedName)
          );
        }

        setIncidents(allIncidents);

        // Calculate incident status counts
        const counts = allIncidents.reduce(
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
    },
    [entityFQN, isColumnDetailPanel]
  );

  useEffect(() => {
    if (!hasViewTests) {
      setIsLoading(false);

      return;
    }
    fetchTestCases(searchText);
  }, [entityFQN, hasViewTests, searchText]);

  useEffect(() => {
    if (!hasViewTests) {
      return;
    }
    if (!isColumnDetailPanel) {
      fetchIncidents();
    }
  }, [entityFQN, hasViewTests, fetchIncidents, isColumnDetailPanel]);

  const hasFetchedColumnIncidents = useRef(false);

  useEffect(() => {
    hasFetchedColumnIncidents.current = false;
  }, [entityFQN]);

  useEffect(() => {
    if (
      isColumnDetailPanel &&
      testCases.length > 0 &&
      hasViewTests &&
      !hasFetchedColumnIncidents.current
    ) {
      hasFetchedColumnIncidents.current = true;
      fetchIncidents(testCases);
    }
  }, [fetchIncidents, isColumnDetailPanel, testCases, hasViewTests]);

  // Filter test cases based on active filter (search text is handled server-side)
  const filteredTestCases = useMemo(() => {
    return testCases.filter((testCase) => {
      const status = testCase.testCaseResult?.testCaseStatus;

      return status?.toLowerCase() === activeFilter;
    });
  }, [testCases, activeFilter]);

  // Filter incidents based on active incident filter and search text
  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const status = incident.testCaseResolutionStatusType;
      if (!status) {
        return false;
      }

      const matchesStatus =
        status === INCIDENT_FILTER_STATUS_MAP[activeIncidentFilter];

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
    const matchingTestCase = testCases.find(
      (tc) =>
        tc.fullyQualifiedName === incident.testCaseReference?.fullyQualifiedName
    );

    return {
      id: incident.id || '',
      name:
        incident.testCaseReference?.displayName ||
        incident.testCaseReference?.name ||
        'Unknown Test Case',
      fullyQualifiedName: incident.testCaseReference?.fullyQualifiedName || '',
      entityLink: matchingTestCase?.entityLink || '',
      testCaseResult: {
        testCaseStatus: incident.testCaseResolutionStatusType as string,
        timestamp: incident.timestamp || Date.now(),
      },
      incidentId: incident.id,
    } as TestCase;
  };

  const renderTestCaseCards = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (filteredTestCases.length > 0) {
      return (
        <Box className="tw:-ml-4" direction="col" gap={3}>
          {filteredTestCases.map((testCase) => (
            <TestCaseCard key={testCase.id} testCase={testCase} />
          ))}
        </Box>
      );
    }

    return (
      <div className="no-test-cases tw:px-4 tw:py-8 tw:text-center">
        <Typography
          className="no-data-placeholder"
          color="secondary"
          size="text-xs">
          {t('label.no-entity', {
            entity: t('label.test-case-plural'),
          })}
        </Typography>
      </div>
    );
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
        <Box direction="col" gap={3}>
          {filteredIncidents.map((incident) => (
            <TestCaseCard
              incident={incident}
              key={incident.id}
              testCase={convertIncidentToTestCase(incident)}
            />
          ))}
        </Box>
      );
    }

    return (
      <div className="no-incidents tw:p-6 tw:text-center">
        <Typography color="secondary" size="text-sm">
          {t('message.no-entity-found-for-name', {
            entity: t('label.incident-plural'),
            name: `${t('label.type-filed-name', {
              fieldName: startCase(activeIncidentFilter),
            })}`,
          })}
        </Typography>
      </div>
    );
  };

  const renderDataQualityTabContent = () => {
    if (isLoading && statusCounts.total === 0) {
      return (
        <div className="flex-center p-lg">
          <Loader size="default" />
        </div>
      );
    }

    if (statusCounts.total === 0) {
      return (
        <ErrorPlaceHolderNew
          className="text-grey-14 m-t-lg"
          icon={<AddPlaceHolderIcon height={100} width={100} />}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography
            as="div"
            className="text-center p-x-md no-data-placeholder tw:mb-4"
            color="secondary"
            size="text-xs">
            {t('message.no-data-quality-test-message')}
          </Typography>
        </ErrorPlaceHolderNew>
      );
    }

    return (
      <div className="data-quality-tab-content tw:h-screen tw:pl-4">
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
          onFilterChange={handleFilterChange}
        />
        <div className="test-case-cards-section tw:mt-4">
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
          {renderTestCaseCards()}
        </div>
      </div>
    );
  };

  const renderIncidentsTabContent = () => {
    if (isIncidentsLoading) {
      return (
        <div className="flex-center p-lg">
          <Loader size="default" />
        </div>
      );
    }

    if (incidentCounts.total === 0) {
      return (
        <div className="m-t-lg">
          <ErrorPlaceHolderNew
            className="text-grey-14"
            icon={<AddPlaceHolderIcon height={100} width={100} />}
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography
              as="div"
              className="text-center p-x-md no-data-placeholder tw:mb-4"
              color="secondary"
              size="text-xs">
              {t('message.no-data-quality-test-message')}
            </Typography>
          </ErrorPlaceHolderNew>
        </div>
      );
    }

    return (
      <div className="incidents-tab-content tw:px-4">
        <div className="incidents-stats-container">
          <div className="incidents-stats-cards-container">
            <button
              className={`incident-stat-card new-card ${
                activeIncidentFilter === 'new' ? 'active' : ''
              }`}
              type="button"
              onClick={() => handleIncidentFilterChange('new')}>
              <Typography className="stat-count new">
                {incidentCounts.new}
              </Typography>
              <Typography className="stat-label new">
                {t('label.new')}
              </Typography>
            </button>
            <Divider
              aria-hidden="true"
              className="tw:my-3"
              orientation="vertical"
            />
            <button
              className={`incident-stat-card ack-card ${
                activeIncidentFilter === 'ack' ? 'active' : ''
              }`}
              type="button"
              onClick={() => handleIncidentFilterChange('ack')}>
              <Typography className="stat-count ack">
                {incidentCounts.ack}
              </Typography>
              <Typography className="stat-label ack">
                {t('label.acknowledged')}
              </Typography>
            </button>
            <Divider
              aria-hidden="true"
              className="tw:my-3"
              orientation="vertical"
            />
            <button
              className={`incident-stat-card assigned-card ${
                activeIncidentFilter === 'assigned' ? 'active' : ''
              }`}
              type="button"
              onClick={() => handleIncidentFilterChange('assigned')}>
              <Typography className="stat-count assigned">
                {incidentCounts.assigned}
              </Typography>
              <Typography className="stat-label assigned">
                {t('label.assigned')}
              </Typography>
            </button>
          </div>
          <div>
            <button
              className={classNames('resolved-section', {
                active: activeIncidentFilter === 'resolved',
              })}
              type="button"
              onClick={() => handleIncidentFilterChange('resolved')}>
              <Typography className="resolved-label">
                {t('label.-with-colon', { text: t('label.resolved') })}
              </Typography>
              <Typography className="resolved-value">
                {incidentCounts.resolved}
              </Typography>
            </button>
          </div>
        </div>
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
          <div className="incident-cards-section tw:-mx-4">
            {renderIncidentCards()}
          </div>
        </div>
      </div>
    );
  };

  const tabItems = [
    {
      key: DATA_QUALITY_TAB_KEY,
      label: t('label.data-quality'),
      count: statusCounts.total,
      children: renderDataQualityTabContent(),
    },
    {
      key: 'incidents',
      label: t('label.incident-plural'),
      count: incidentCounts.total,
      children: renderIncidentsTabContent(),
    },
  ];

  if (!hasViewTests) {
    return (
      <div className="lineage-items-list">
        <ErrorPlaceHolderNew
          className="text-grey-14 permission-error-placeholder"
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}>
          <Transi18next
            i18nKey="message.no-access-placeholder"
            renderElement={<span />}
            values={{
              entity: t('label.view-entity', {
                entity: t('label.data-quality'),
              }),
            }}
          />
        </ErrorPlaceHolderNew>
      </div>
    );
  }

  return (
    <div className="data-quality-tab-container">
      <Tabs
        className="data-quality-tabs"
        selectedKey={activeTab}
        onSelectionChange={(key) => handleTabChange(String(key))}>
        <Tabs.List
          className={classNames(
            'tw:sticky tw:z-3 tw:gap-8 tw:bg-surface tw:px-4 tw:pt-2.5',
            // Sits below the sticky entity title, which the column panel and the side drawer do not render.
            isColumnDetailPanel
              ? 'tw:top-0'
              : 'tw:top-[54px] tw:[.drawer-summary-panel-container_&]:top-0'
          )}
          size="sm"
          type="underline">
          {tabItems.map(({ key, label, count }) => (
            <Tabs.Item badge={count} id={key} key={key}>
              {label}
            </Tabs.Item>
          ))}
        </Tabs.List>
        {tabItems.map(({ key, children }) => (
          <Tabs.Panel id={key} key={key}>
            {children}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
};

export default DataQualityTab;
