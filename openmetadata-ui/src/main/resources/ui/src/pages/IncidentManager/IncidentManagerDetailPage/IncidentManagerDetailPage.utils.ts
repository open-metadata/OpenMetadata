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

import type { TFunction } from 'i18next';
import {
  PipelineType,
  type IngestionPipeline,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import type { TestCase } from '../../../generated/tests/testCase';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import { getNextCronRunTimestamp } from '../../../utils/CronUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { TestCasePageTabs } from '../IncidentManager.interface';
import {
  TEST_SUITE_PIPELINE_FIELDS,
  TEST_SUITE_PIPELINE_LIMIT,
} from './IncidentManagerDetailPage.constants';
import type { UseTestCaseDetailPageResult } from './useTestCaseDetailPage';

const getPipelineNextRunTimestamp = async (pipeline: IngestionPipeline) => {
  const scheduleInterval = pipeline.airflowConfig?.scheduleInterval;

  if (
    pipeline.enabled === false ||
    pipeline.airflowConfig?.pausePipeline ||
    !scheduleInterval
  ) {
    return undefined;
  }

  return getNextCronRunTimestamp(
    scheduleInterval,
    pipeline.airflowConfig?.pipelineTimezone
  );
};

export const fetchNextTestCaseRunTimestamp = async (
  testSuiteFqns: string[]
) => {
  const responses = await Promise.all(
    testSuiteFqns.map((testSuite) =>
      getIngestionPipelines({
        arrQueryFields: TEST_SUITE_PIPELINE_FIELDS,
        limit: TEST_SUITE_PIPELINE_LIMIT,
        pipelineType: [PipelineType.TestSuite],
        testSuite,
      })
    )
  );
  const nextRuns = (
    await Promise.all(
      responses.flatMap(({ data }) => data).map(getPipelineNextRunTimestamp)
    )
  ).filter((nextRun): nextRun is number => nextRun !== undefined);

  return nextRuns.length ? Math.min(...nextRuns) : undefined;
};

export const getTestSuiteFqns = (testCase?: TestCase) => {
  const fqns = [
    testCase?.testSuite?.fullyQualifiedName ?? testCase?.testSuite?.name,
    ...(testCase?.testSuites?.map(
      (testSuite) => testSuite.fullyQualifiedName ?? testSuite.name
    ) ?? []),
  ].filter((fqn): fqn is string => Boolean(fqn));

  return [...new Set(fqns)];
};

export const shouldFetchNextRun = ({
  activeTab,
  dimensionKey,
  isVersionPage,
  testSuiteFqns,
}: {
  activeTab: UseTestCaseDetailPageResult['activeTab'];
  dimensionKey: UseTestCaseDetailPageResult['dimensionKey'];
  isVersionPage: boolean;
  testSuiteFqns: string[];
}) =>
  Boolean(
    testSuiteFqns.length &&
      !isVersionPage &&
      !dimensionKey &&
      activeTab === TestCasePageTabs.TEST_CASE_RESULTS
  );

export const getIncidentManagerPageTitle = (
  t: TFunction,
  isVersionPage: boolean,
  testCase: TestCase
) =>
  t(
    isVersionPage
      ? 'label.entity-version-detail-plural'
      : 'label.entity-detail-plural',
    {
      entity: getEntityName(testCase) || t('label.test-case'),
    }
  );
