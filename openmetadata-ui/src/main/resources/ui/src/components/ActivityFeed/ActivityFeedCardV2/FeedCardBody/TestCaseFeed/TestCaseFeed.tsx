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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESCRIPTION_MAX_PREVIEW_CHARACTERS } from '../../../../../constants/constants';
import {
  formatTestStatusData,
  getTestCaseResultCount,
  getTestNamesListMarkdown,
} from '../../../../../utils/FeedUtils';
import RichTextEditorPreviewer from '../../../../common/RichTextEditor/RichTextEditorPreviewer';
import './test-case-feed.less';
import { TestCaseFeedProps } from './TestCaseFeed.interface';

function TestCaseFeed({ testResultSummary }: Readonly<TestCaseFeedProps>) {
  const { t } = useTranslation();

  const { success, failed, aborted } = useMemo(
    () => formatTestStatusData(testResultSummary),
    [testResultSummary]
  );

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

      <Col span={24}>
        <RichTextEditorPreviewer
          markdown={getTestNamesListMarkdown([aborted, failed])}
          maxLength={DESCRIPTION_MAX_PREVIEW_CHARACTERS}
        />
      </Col>
    </Row>
  );
}

export default TestCaseFeed;
