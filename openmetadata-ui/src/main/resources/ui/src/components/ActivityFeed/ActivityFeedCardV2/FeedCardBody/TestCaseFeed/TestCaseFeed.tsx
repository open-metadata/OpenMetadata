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
import { Button, Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { groupBy, isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AbortedStatus } from '../../../../../assets/svg/aborted-status.svg';
import { ReactComponent as FailedStatus } from '../../../../../assets/svg/failed-status.svg';
import { EntityTestResultSummaryObject } from '../../../../../generated/entity/feed/thread';
import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import {
  formatTestStatusData,
  getTestCaseResultCount,
} from '../../../../../utils/FeedUtils';
import './test-case-feed.less';
import { TestCaseFeedProps } from './TestCaseFeed.interface';

function TestCaseFeed({ entitySpecificInfo }: Readonly<TestCaseFeedProps>) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);

  const { success, failed, aborted } = useMemo(
    () =>
      formatTestStatusData(
        entitySpecificInfo?.entityTestResultSummary as EntityTestResultSummaryObject[]
      ),
    [entitySpecificInfo?.entityTestResultSummary]
  );

  const handleShowMore = useCallback(() => {
    setShowMore((prev) => !prev);
  }, [setShowMore]);

  const renderTestCaseResult = useMemo(() => {
    const groupResult = groupBy(
      entitySpecificInfo?.testCaseResult ?? [],
      'testCaseStatus'
    );

    if (
      isEmpty(groupResult[TestCaseStatus.Failed]) &&
      isEmpty(groupResult[TestCaseStatus.Aborted])
    ) {
      return;
    }

    return (
      <>
        <div className={classNames({ 'h-24 overflow-hidden': !showMore })}>
          {Object.keys(groupResult).map((key) => {
            if (key === TestCaseStatus.Success) {
              return;
            }

            return (
              <Row className="m-t-xs" gutter={[0, 4]} key={key}>
                <Col span={24}>
                  <Typography.Text className="font-bold">
                    {key === TestCaseStatus.Failed ? (
                      <Icon
                        component={FailedStatus}
                        style={{ fontSize: '16px' }}
                      />
                    ) : (
                      <Icon
                        component={AbortedStatus}
                        style={{ fontSize: '16px' }}
                      />
                    )}{' '}
                    {`${key} :`}
                  </Typography.Text>
                </Col>
                <Col span={24}>
                  {groupResult[key].map((caseResult) => {
                    return (
                      <Row
                        gutter={[10, 0]}
                        key={caseResult.timestamp}
                        wrap={false}>
                        <Col flex="300px">
                          <div className="d-flex">
                            <Typography.Link className="break-all whitespace-normal">
                              {caseResult.testCaseName}
                            </Typography.Link>
                            <span>:</span>
                          </div>
                        </Col>
                        <Col flex="auto">
                          <Typography.Text className="break-all whitespace-normal">
                            {caseResult.result}
                          </Typography.Text>
                        </Col>
                      </Row>
                    );
                  })}
                </Col>
              </Row>
            );
          })}
        </div>

        <Button
          className="m-t-xs"
          size="small"
          type="link"
          onClick={handleShowMore}>
          {showMore ? t('label.less') : t('label.more')}
        </Button>
      </>
    );
  }, [showMore, entitySpecificInfo?.testCaseResult, handleShowMore]);

  return (
    <Row gutter={[0, 12]}>
      <Col span={24}>
        <Typography.Text className="font-bold">{`${t(
          'label.tests-summary'
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
