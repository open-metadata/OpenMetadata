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

import { Col, Row, Typography } from 'antd';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import Loader from '../../../common/Loader/Loader';
import '../TestCaseResultTab/test-case-result-tab.style.less';

/**
 * RcaExplanationTab renders the AI-generated root cause analysis for a
 * failed test case.  It is modelled exactly after SqlQueryTab:
 *   - zero external props (reads from useTestCaseStore)
 *   - same Row/Col/Typography layout used across DQ tabs
 *   - same import of formatDateTime for epoch-ms timestamps
 *   - same Loader guard for the loading state
 *
 * The tab is only added to the tab-strip when rcaExplanation is present
 * on testCase.testCaseResult (guard lives in TestCaseClassBase.getTab +
 * IncidentManagerDetailPage.fetchTestCaseData), so we never render an
 * empty state here.
 */
const RcaExplanationTab = () => {
  const { testCase, isLoading } = useTestCaseStore();
  const { t } = useTranslation();

  const rcaExplanation = testCase?.testCaseResult?.rcaExplanation;
  const rcaGeneratedAt = testCase?.testCaseResult?.rcaGeneratedAt;

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row className="p-md" gutter={[16, 16]}>
      {/* Generated-by label ------------------------------------------------ */}
      <Col span={24}>
        <Typography.Text className="text-grey-muted" type="secondary">
          {t('label.generated-by-ai')}
          {!isUndefined(rcaGeneratedAt) && (
            <> &mdash; {formatDateTime(rcaGeneratedAt)}</>
          )}
        </Typography.Text>
      </Col>

      {/* Explanation body -------------------------------------------------- */}
      <Col span={24}>
        <Typography.Paragraph className="m-b-0">
          {rcaExplanation}
        </Typography.Paragraph>
      </Col>
    </Row>
  );
};

export default RcaExplanationTab;
