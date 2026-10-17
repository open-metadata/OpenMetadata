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

import { Typography } from '@openmetadata/ui-core-components';
import {
  Calendar,
  DataQuality,
  ShieldTick,
} from '@openmetadata/ui-core-components/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useDataQualitySummary } from '../../../../hooks/useDataQualitySummary';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import {
  DataQualityRange,
  DataQualityScope,
  DEFAULT_DATA_QUALITY_FILTERS,
} from '../../../../utils/dataQualityFilters';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import FilterButton from '../Common/TopicWidget/FilterButton';
import TestStatusBar from '../Common/TopicWidget/TestStatusBar';
import TopicCard from '../Common/TopicWidget/TopicCard';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';
import DataQualityTestRows from './DataQualityTestRows';
import { DataQualityGroupBy } from './DataQualityTestRows.utils';

const TONE = {
  icon: DataQuality,
  tile: 'tw:bg-utility-error-50 tw:text-utility-error-600',
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
  // Arranges the rows, not a query filter: the same tests either way.
  const [groupBy, setGroupBy] = useState(DataQualityGroupBy.TABLE);
  const {
    passed,
    failed,
    aborted,
    total,
    tests,
    tableCounts,
    hasNoTests,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useDataQualitySummary(
    filters,
    currentUser?.name,
    currentUser
      ? {
          id: currentUser.id,
          teamIds: (currentUser.teams ?? []).map((team) => team.id),
        }
      : undefined
  );

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
  const groupOptions = useMemo(
    () => [
      { label: t('label.table'), value: DataQualityGroupBy.TABLE },
      { label: t('label.test-case'), value: DataQualityGroupBy.TEST_CASE },
    ],
    [t]
  );

  // Against the bucket total, not the rows shown: the rows are the latest
  // results, and "N more" is the rest of the failing bucket.
  const shownFailures = tests.filter(
    (test) => test.testCaseResult?.testCaseStatus === TestCaseStatus.Failed
  ).length;
  const hiddenFailures = Math.max(0, failed - shownFailures);

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
              label={t('label.group-by')}
              options={groupOptions}
              testId="dq-group-by"
              value={groupBy}
              onChange={(value) => setGroupBy(value as DataQualityGroupBy)}
            />
          </div>

          <TestStatusBar
            aborted={aborted}
            failed={failed}
            passed={passed}
            total={total}
          />

          {tests.length === 0 ? (
            // `!` on the colour: Typography renders `.prose`, whose unlayered
            // `color` rule is emitted after the Tailwind utilities.
            <Typography
              className="tw:mt-4 tw:text-text-secondary!"
              data-testid="data-quality-empty"
              size="text-xs">
              {total === 0
                ? t('message.no-test-results-yet')
                : t('message.no-failing-tests')}
            </Typography>
          ) : (
            <DataQualityTestRows
              groupBy={groupBy}
              tableCounts={tableCounts}
              tests={tests}
            />
          )}
        </>
      )}
    </TopicCard>
  );
};

export default DataQualityWidget;
