/*
 *  Copyright 2026 Collate.
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
  Badge,
  Button,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { Database01 } from '@openmetadata/ui-core-components/icons';
import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import { TestCasePageTabs } from '../../../../enums/TestSuite.enum';
import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import {
  TableStatusCounts,
  toTableCountsKey,
} from '../../../../utils/dataQualityFilters';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import {
  COUNT_TEXT,
  GROUP_COUNTS,
  INCIDENT_STATUS,
  TEST_STATUS,
} from './DataQualityTestRows.constants';
import {
  DataQualityGroupBy,
  DataQualityTableGroup,
  getTestColumnName,
  groupTestsByTable,
} from './DataQualityTestRows.utils';

const lastFqnPart = (fqn: string) => fqn.split('.').pop() ?? fqn;

/** The table's counts across the card's scope, or the rows shown without them. */
const countsFor = (
  group: DataQualityTableGroup,
  tableCounts?: Record<string, TableStatusCounts>
): TableStatusCounts =>
  tableCounts?.[toTableCountsKey(group.tableFqn)] ?? group;

const incidentOf = (test: TestCase) => {
  const type = test.incidentStatus?.testCaseResolutionStatusType;

  return type ? INCIDENT_STATUS[type] : undefined;
};

/** "Incident: Assigned", the stage in its own colour; nothing without one. */
const IncidentLine: React.FC<{ test: TestCase }> = ({ test }) => {
  const { t } = useTranslation();
  const incident = incidentOf(test);

  if (!incident) {
    return null;
  }

  return (
    <Typography
      className="tw:min-w-0 tw:text-quaternary!"
      data-testid={`dq-incident-${test.id}`}
      size="text-xs">
      <Trans
        components={[
          <span className={`tw:font-medium ${incident.text}`} key="status" />,
        ]}
        i18nKey="message.incident-with-status"
        values={{ status: t(incident.labelKey) }}
      />
    </Typography>
  );
};

/**
 * The test's own page, where its results and incident live — the Data Quality
 * list has no `testCase` parameter to land on. An aborted run with nobody on it
 * is the one row whose next step is to open an incident, from the Issues tab
 * as everywhere else.
 */
const RowAction: React.FC<{ test: TestCase }> = ({ test }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canRaiseIncident =
    test.testCaseResult?.testCaseStatus === TestCaseStatus.Aborted &&
    !incidentOf(test);
  const testPath = (tab?: TestCasePageTabs) =>
    observabilityRouterClassBase.getTestCaseDetailPagePath(
      test.fullyQualifiedName ?? '',
      tab
    );

  return canRaiseIncident ? (
    <Button
      className="tw:shrink-0"
      color="link-color"
      data-testid={`dq-raise-incident-${test.id}`}
      size="xs"
      onPress={() => navigate(testPath(TestCasePageTabs.ISSUES))}>
      {t('label.raise-incident')}
    </Button>
  ) : (
    <Button
      className="tw:shrink-0"
      color="link-color"
      data-testid={`dq-view-test-${test.id}`}
      size="xs"
      onPress={() => navigate(testPath())}>
      {t('label.view-entity', { entity: t('label.test') })}
    </Button>
  );
};

interface TestRowProps {
  test: TestCase;
  /** Under a table header the table is already named; the row names its column. */
  isGrouped: boolean;
}

const TestRow: React.FC<TestRowProps> = ({ test, isGrouped }) => {
  const { t } = useTranslation();
  const status =
    TEST_STATUS[test.testCaseResult?.testCaseStatus as TestCaseStatus];
  const column = getTestColumnName(test.entityLink);
  const meta = isGrouped ? column : getEntityFQN(test.entityLink ?? '');

  return (
    <li
      className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:py-3"
      data-testid={`dq-test-${test.id}`}>
      {status && (
        <FeaturedIcon
          color={status.color}
          icon={status.icon}
          radius="lg"
          shape="square"
          size="sm"
          theme="light"
        />
      )}
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
          <Typography
            className="tw:min-w-0 tw:text-text-primary!"
            ellipsis={{ rows: 1 }}
            size="text-xs"
            weight="medium">
            {test.displayName ?? test.name}
          </Typography>
          {status && (
            <Badge
              className="tw:shrink-0"
              color={status.color}
              size="sm"
              type="pill-color">
              {t(status.labelKey)}
            </Badge>
          )}
        </span>
        {meta && (
          <Typography
            className="tw:min-w-0 tw:text-quaternary!"
            ellipsis={{ rows: 1 }}
            size="text-xs">
            {meta}
          </Typography>
        )}
        <IncidentLine test={test} />
      </div>
      <RowAction test={test} />
    </li>
  );
};

export interface DataQualityTestRowsProps {
  tests: TestCase[];
  groupBy: DataQualityGroupBy;
  /** Every result per table, when known; otherwise a header counts its rows. */
  tableCounts?: Record<string, TableStatusCounts>;
}

/**
 * The latest results, either under the table each runs on — a header naming
 * the table with its own pass/fail split — or as one flat list of test cases.
 */
const DataQualityTestRows: React.FC<DataQualityTestRowsProps> = ({
  tests,
  groupBy,
  tableCounts,
}) => {
  const { t } = useTranslation();
  const groups = useMemo(() => groupTestsByTable(tests), [tests]);

  if (groupBy === DataQualityGroupBy.TEST_CASE) {
    return (
      <ul
        className="tw:mt-4 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
        data-testid="data-quality-rows">
        {tests.map((test) => (
          <TestRow isGrouped={false} key={test.id} test={test} />
        ))}
      </ul>
    );
  }

  return (
    <div
      className="tw:mt-4 tw:flex tw:flex-col"
      data-testid="data-quality-rows">
      {groups.map((group) => (
        <section
          aria-label={group.tableFqn}
          data-testid={`dq-table-group-${group.tableFqn}`}
          key={group.tableFqn}>
          <div className="tw:-mx-5 tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:bg-secondary tw:px-5 tw:py-2">
            <FeaturedIcon
              color="brand"
              icon={Database01}
              radius="md"
              shape="square"
              size="sm"
              theme="light"
            />
            <Link
              className="tw:min-w-0 tw:truncate tw:text-xs tw:font-semibold tw:text-brand-secondary"
              to={getEntityDetailsPath(EntityType.TABLE, group.tableFqn)}>
              {lastFqnPart(group.tableFqn)}
            </Link>
            <Typography
              className="tw:min-w-0 tw:flex-1 tw:text-tertiary!"
              ellipsis={{ rows: 1 }}
              size="text-xs">
              {group.tableFqn}
            </Typography>
            {GROUP_COUNTS.filter(
              ({ key }) => countsFor(group, tableCounts)[key] > 0
            ).map(({ key, color, messageKey }) => (
              <Typography
                className={`tw:shrink-0 ${COUNT_TEXT[color]}`}
                key={key}
                size="text-xs"
                weight="medium">
                {t(messageKey, {
                  count: countsFor(group, tableCounts)[key],
                })}
              </Typography>
            ))}
          </div>
          <ul className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary">
            {group.tests.map((test) => (
              <TestRow isGrouped key={test.id} test={test} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default DataQualityTestRows;
