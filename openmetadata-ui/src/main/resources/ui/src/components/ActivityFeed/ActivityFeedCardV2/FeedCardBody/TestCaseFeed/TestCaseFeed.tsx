/*
 *  Copyright 2024 Collate.
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { TEST_CASE_FEED_GRAPH_HEIGHT } from '../../../../../constants/constants';
import { PROFILER_FILTER_RANGE } from '../../../../../constants/profiler.constant';
import {
  EntityTestResultSummaryObject,
  TestCaseStatus,
} from '../../../../../generated/entity/feed/thread';
import {
  formatTestStatusData,
  getTestCaseResultCount,
} from '../../../../../utils/FeedUtils';
import TestSummaryGraph from '../../../../Database/Profiler/TestSummary/TestSummaryGraph';
import './test-case-feed.less';
import { TestCaseFeedProps } from './TestCaseFeed.interface';

function TestCaseFeed({
  entitySpecificInfo,
  testCaseName,
}: Readonly<TestCaseFeedProps>) {
  const { t } = useTranslation();

  const { success, failed, aborted } = useMemo(
    () =>
      formatTestStatusData(
        entitySpecificInfo?.entityTestResultSummary as EntityTestResultSummaryObject[]
      ),
    [entitySpecificInfo?.entityTestResultSummary]
  );

  const { testCaseResult, showTestCaseGraph } = useMemo(() => {
    const testCaseResult = (entitySpecificInfo?.testCaseResult ?? []).slice(
      0,
      10
    );

    return {
      testCaseResult,
      showTestCaseGraph: !testCaseResult.every(
        (item) => item.testCaseStatus === TestCaseStatus.Success
      ),
    };
  }, [entitySpecificInfo?.testCaseResult]);

  const renderTestCaseResult = useMemo(() => {
    return (
      <Row className="m-t-xs" gutter={[0, 4]}>
        <TestSummaryGraph
          minHeight={TEST_CASE_FEED_GRAPH_HEIGHT}
          selectedTimeRange={PROFILER_FILTER_RANGE.last7days.title}
          testCaseName={testCaseName}
          testCaseParameterValue={entitySpecificInfo?.parameterValues}
          testCaseResults={testCaseResult}
        />
      </Row>
    );
  }, [testCaseName, testCaseResult, entitySpecificInfo?.parameterValues]);

  return (
    <Row gutter={[0, 12]}>
      <Col span={24}>
        <Typography.Text className="font-bold">{`${t(
          'label.test-suite-summary'
        )}:`}</Typography.Text>
      </Col>
      <Col span={24}>
        <Row gutter={16}>
          {[success, aborted, failed].map((testCase) => (
            <Col key={`count-badge-${testCase.status}`}>
              {getTestCaseResultCount(testCase.count, testCase.status)}
            </Col>
          ))}
        </Row>
      </Col>

      {showTestCaseGraph && <Col span={24}>{renderTestCaseResult}</Col>}
    </Row>
  );
}

export default TestCaseFeed;
