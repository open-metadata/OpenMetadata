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
import { DataQuality } from '@openmetadata/ui-core-components/icons';
import { Calendar } from '@openmetadata/ui-core-components/icons';
import { TestCaseType } from '../../../../enums/TestSuite.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DataQualityRange,
  DataQualityScope,
  DEFAULT_DATA_QUALITY_FILTERS,
} from '../../../../utils/dataQualityFilters';
import TestStatusBar from '../Common/TopicWidget/TestStatusBar';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import { useDataQualitySummary } from '../../../../hooks/useDataQualitySummary';
import FilterButton from '../Common/TopicWidget/FilterButton';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';

// The card is a digest; the footer link opens the full Data Quality view.
const MAX_VISIBLE_ROWS = 4;

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
  const { passed, failed, aborted, total, failedTests, isError } =
    useDataQualitySummary(filters, currentUser?.name);

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
        label: t('label.last-count-days', { count: Number(days) }),
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

  const summary = isError
    ? t('message.something-went-wrong')
    : `${t('message.count-total-tests', { count: total })} · ${t(
        'message.count-failed',
        { count: failed }
      )}`;

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.data-quality') }),
        onPress: () =>
          navigate(observabilityRouterClassBase.getDataQualityPagePath()),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      meta={
        failedTests.length < failed
          ? t('message.count-more-assets-match-rule', {
              count: failed - failedTests.length,
            })
          : undefined
      }
      status={
        failed > 0
          ? {
              color: 'error',
              label: t('message.count-failed', { count: failed }),
            }
          : undefined
      }
      summary={summary}
      title={t('label.data-quality')}
      tone={TONE}
      topicKey={TopicKey.DATA_QUALITY}
      widgetKey={widgetKey}>
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

      {failedTests.length === 0 ? (
        // `!` on the colour: Typography renders `.prose`, whose unlayered
        // `color` rule is emitted after the Tailwind utilities.
        <Typography className="tw:mt-4 tw:text-text-secondary!" size="text-sm">
          {t('message.no-test-results-yet')}
        </Typography>
      ) : (
        <ul
          className="tw:mt-4 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="data-quality-rows">
          {failedTests.slice(0, MAX_VISIBLE_ROWS).map((test) => {
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
                <Button
                  className="tw:shrink-0"
                  color="link-color"
                  size="sm"
                  onPress={() =>
                    navigate(
                      `${observabilityRouterClassBase.getDataQualityPagePath()}?testCase=${
                        test.fullyQualifiedName ?? ''
                      }`
                    )
                  }>
                  {t('label.view-entity', { entity: t('label.test') })}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </TopicCard>
  );
};

export default DataQualityWidget;
