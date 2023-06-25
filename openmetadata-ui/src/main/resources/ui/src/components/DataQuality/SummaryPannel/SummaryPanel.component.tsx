/*
 *  Copyright 2023 Collate.
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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { SummaryCard } from 'components/common/SummaryCard/SummaryCard.component';
import { TestSummary } from 'generated/tests/testSuite';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTestCaseExecutionSummary } from 'rest/testAPI';
import {} from 'utils/CommonUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { SummaryPanelProps } from './SummaryPanel.interface';

export const SummaryPanel = ({ testSuiteId }: SummaryPanelProps) => {
  const { t } = useTranslation();

  const [summary, setSummary] = useState<TestSummary>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchTestSummary = async () => {
    setIsLoading(true);
    try {
      const response = await getTestCaseExecutionSummary(testSuiteId);
      setSummary(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestSummary();
  }, [testSuiteId]);

  return (
    <Row wrap gutter={[16, 16]}>
      <Col flex="25%">
        <SummaryCard
          className="h-full"
          isLoading={isLoading}
          showProgressBar={false}
          title={t('label.total-entity', { entity: t('label.test-plural') })}
          total={summary?.total ?? 0}
          value={summary?.total ?? 0}
        />
      </Col>
      <Col flex="25%">
        <SummaryCard
          isLoading={isLoading}
          title={t('label.success')}
          total={summary?.total ?? 0}
          type="success"
          value={summary?.success ?? 0}
        />
      </Col>
      <Col flex="25%">
        <SummaryCard
          isLoading={isLoading}
          title={t('label.aborted')}
          total={summary?.total ?? 0}
          type="aborted"
          value={summary?.aborted ?? 0}
        />
      </Col>
      <Col flex="25%">
        <SummaryCard
          isLoading={isLoading}
          title={t('label.failed')}
          total={summary?.total ?? 0}
          type="failed"
          value={summary?.failed ?? 0}
        />
      </Col>
    </Row>
  );
};
