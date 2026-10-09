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

import { Badge, Button, Typography } from '@openmetadata/ui-core-components';
import {
  Calendar,
  DataQuality,
  ShieldTick,
} from '@openmetadata/ui-core-components/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TestCaseType } from '../../../../enums/TestSuite.enum';
import { TestCase } from '../../../../generated/tests/testCase';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  DATA_QUALITY_FAILED_ROWS,
  useDataQualitySummary,
} from '../../../../hooks/useDataQualitySummary';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import {
  DataQualityRange,
  DataQualityScope,
  DEFAULT_DATA_QUALITY_FILTERS,
} from '../../../../utils/dataQualityFilters';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import FilterButton from '../Common/TopicWidget/FilterButton';
import TestStatusBar from '../Common/TopicWidget/TestStatusBar';
import TopicCard from '../Common/TopicWidget/TopicCard';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';

const TONE = {
  icon: DataQuality,
  tile: 'tw:bg-utility-error-50 tw:text-utility-error-600',
};

interface FailedTestRowsProps {
  tests: TestCase[];
  /** Every test in scope — what tells "nothing failing" from "nothing run". */
  total: number;
}

/**
 * The failing tests, or why there are none: "no results yet" is reserved for
 * a scope where nothing has run, and a scope whose tests all came back clean
 * says so instead of reading as though it were empty.
 */
const FailedTestRows: React.FC<FailedTestRowsProps> = ({ tests, total }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (tests.length === 0) {
    return (
      // `!` on the colour: Typography renders `.prose`, whose unlayered
      // `color` rule is emitted after the Tailwind utilities.
      <Typography
        className="tw:mt-4 tw:text-text-secondary!"
        data-testid="data-quality-empty"
        size="text-sm">
        {total === 0
          ? t('message.no-test-results-yet')
          : t('message.no-failing-tests')}
      </Typography>
    );
  }

  return (
    <ul
      className="tw:mt-4 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
      data-testid="data-quality-rows">
      {tests.map((test) => {
        const tableFqn = getEntityFQN(test.entityLink ?? '');

        return (
          <li
            className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:py-3"
            data-testid={`failed-test-${test.id}`}
            key={test.id}>
            <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
              <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
                <Typography
                  className="tw:min-w-0 tw:text-text-primary!"
                  ellipsis={{ rows: 1 }}
                  size="text-sm"
                  weight="medium">
                  {test.displayName ?? test.name}
                </Typography>
                <Badge
                  className="tw:shrink-0"
                  color="error"
                  size="sm"
                  type="pill-color">
                  {t('label.failed')}
                </Badge>
              </span>
              {tableFqn && (
                <Typography
                  className="tw:min-w-0 tw:text-text-tertiary!"
                  ellipsis={{ rows: 1 }}
                  size="text-sm">
                  {tableFqn}
                </Typography>
              )}
            </div>
            {/* The test's own page, where its results and incident live — the
              Data Quality list has no `testCase` parameter to land on. */}
            <Button
              className="tw:shrink-0"
              color="link-color"
              data-testid={`dq-view-test-${test.id}`}
              size="sm"
              onPress={() =>
                navigate(
                  observabilityRouterClassBase.getTestCaseDetailPagePath(
                    test.fullyQualifiedName ?? ''
                  )
                )
              }>
              {t('label.view-entity', { entity: t('label.test') })}
            </Button>
          </li>
        );
      })}
    </ul>
  );
};

export type DataQualityWidgetProps = WidgetCommonProps;

/** How the estate's tests are doing, and which ones are failing right now. */
const DataQualityWidget: React.FC<DataQualityWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const [filters, setFilters] = useState(DEFAULT_DATA_QUALITY_FILTERS);
  const {
    passed,
    failed,
    aborted,
    total,
    failedTests,
    hasNoTests,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useDataQualitySummary(filters, currentUser?.name);

  const scopeOptions = useMemo(
    () => [
      { label: t('label.all-data'), value: DataQualityScope.ALL },
      { label: t('label.my-data'), value: DataQualityScope.MINE },
      { label: t('label.followed'), value: DataQualityScope.FOLLOWED },
    ],
    [t]
  );
  const rangeOptions = useMemo(
    () =>
      Object.values(DataQualityRange).map((days) => ({
        label: t('label.last-n-days', { count: Number(days) }),
        value: days,
      })),
    [t]
  );
  const typeOptions = useMemo(
    () => [
      { label: t('label.all'), value: TestCaseType.all },
      { label: t('label.table'), value: TestCaseType.table },
      { label: t('label.column'), value: TestCaseType.column },
    ],
    [t]
  );

  // The card is a digest; the footer link opens the full Data Quality view.
  const visibleTests = failedTests.slice(0, DATA_QUALITY_FAILED_ROWS);
  // Against the bucket total, not the page fetched: the rows are a sample of
  // the failing tests, and "N more" is the rest of the bucket.
  const hiddenFailures = Math.max(0, failed - visibleTests.length);

  // Offered whatever the viewer's role, as on the Data Quality page it opens:
  // whether a test may be added depends on the table picked there.
  const emptyState: TopicEmptyStateConfig | undefined = hasNoTests
    ? {
        action: {
          label: t('label.create-entity', { entity: t('label.test') }),
          onPress: () =>
            navigate(observabilityRouterClassBase.getDataQualityPagePath()),
        },
        description: t('message.data-quality-empty-description'),
        icon: ShieldTick,
        needsSetup: true,
        summary: t('message.data-quality-widget-description'),
        title: t('message.no-test-cases-yet'),
      }
    : undefined;

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.data-quality') }),
        onPress: () =>
          navigate(observabilityRouterClassBase.getDataQualityPagePath()),
      }}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      meta={
        hiddenFailures > 0
          ? t('message.count-more-failing-tests', { count: hiddenFailures })
          : undefined
      }
      status={
        failed > 0
          ? {
              color: 'error',
              label: t('message.count-failed-test', { count: failed }),
            }
          : undefined
      }
      summary={t('message.count-tests-count-failed', {
        count: total,
        failed,
      })}
      title={t('label.data-quality')}
      tone={TONE}
      topicKey={TopicKey.DATA_QUALITY}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {!emptyState && (
        <>
          <div className="tw:mb-4 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <FilterButton
              label={t('label.scope')}
              options={scopeOptions}
              testId="dq-scope-filter"
              value={filters.scope}
              onChange={(scope) =>
                setFilters((prev) => ({
                  ...prev,
                  scope: scope as DataQualityScope,
                }))
              }
            />
            <FilterButton
              iconLeading={Calendar}
              label={t('label.range')}
              options={rangeOptions}
              testId="dq-range-filter"
              value={filters.range}
              onChange={(range) =>
                setFilters((prev) => ({
                  ...prev,
                  range: range as DataQualityRange,
                }))
              }
            />
            <FilterButton
              label={t('label.test')}
              options={typeOptions}
              testId="dq-type-filter"
              value={filters.testCaseType}
              onChange={(testCaseType) =>
                setFilters((prev) => ({
                  ...prev,
                  testCaseType: testCaseType as TestCaseType,
                }))
              }
            />
          </div>

          <TestStatusBar
            aborted={aborted}
            failed={failed}
            passed={passed}
            total={total}
          />

          <FailedTestRows tests={visibleTests} total={total} />
        </>
      )}
    </TopicCard>
  );
};

export default DataQualityWidget;
