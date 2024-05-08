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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Col, Row, Typography } from 'antd';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AbortedStatus } from '../../../../../assets/svg/aborted-status.svg';
import { ReactComponent as FailedStatus } from '../../../../../assets/svg/failed-status.svg';
import { ReactComponent as SuccessStatus } from '../../../../../assets/svg/success-badge.svg';

import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import { customFormatDateTime } from '../../../../../utils/date-time/DateTimeUtils';
import {
  formatTestStatusData,
  getTestCaseResultCount,
} from '../../../../../utils/FeedUtils';
import './test-case-feed.less';
import { TestCaseFeedProps } from './TestCaseFeed.interface';

function TestCaseFeed({ entitySpecificInfo }: Readonly<TestCaseFeedProps>) {
  const { t } = useTranslation();

  const { success, failed, aborted } = useMemo(
    () => formatTestStatusData(entitySpecificInfo?.testCaseResult ?? []),
    [entitySpecificInfo?.testCaseResult]
  );

  const getStatusIcon = useCallback((status?: string) => {
    let icon = SuccessStatus;
    if (status === TestCaseStatus.Failed) {
      icon = FailedStatus;
    } else if (status === TestCaseStatus.Aborted) {
      icon = AbortedStatus;
    }

    return <Icon component={icon} style={{ fontSize: '16px' }} />;
  }, []);

  const renderTestCaseResult = useMemo(() => {
    return (
      <div className="h-24">
        <Row className="m-t-xs" gutter={[0, 4]}>
          {entitySpecificInfo?.testCaseResult?.slice(0, 3).map((caseResult) => {
            return (
              <Col key={caseResult.timestamp} span={24}>
                {getStatusIcon(caseResult.testCaseStatus)}{' '}
                <Typography.Text className="m-l-xss break-all whitespace-normal">
                  {customFormatDateTime(caseResult.timestamp, 'MMM dd, hh:mm')}
                </Typography.Text>
                <span className="m-x-xss">:</span>
                <Typography.Text className="break-all whitespace-normal">
                  {caseResult.result}
                </Typography.Text>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  }, [entitySpecificInfo?.testCaseResult]);

  return (
    <Row gutter={[0, 12]}>
      <Col span={24}>
        <Typography.Text className="font-bold">{`${t(
          'label.test-result-summary'
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

      <Col span={24}>{renderTestCaseResult}</Col>
    </Row>
  );
}

export default TestCaseFeed;
