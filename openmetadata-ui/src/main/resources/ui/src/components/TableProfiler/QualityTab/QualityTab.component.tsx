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
import { Col, Row, Tabs } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SummaryPanel } from '../../../components/DataQuality/SummaryPannel/SummaryPanel.component';
import DataQualityTab from '../../../components/ProfilerDashboard/component/DataQualityTab';
import TestSuitePipelineTab from '../../../components/TestSuite/TestSuitePipelineTab/TestSuitePipelineTab.component';
import { INITIAL_TEST_SUMMARY } from '../../../constants/TestSuite.constant';
import { EntityTabs } from '../../../enums/entity.enum';
import { QualityTabProps } from './QualityTab.interface';

export const QualityTab = ({
  isLoading,
  testCases,
  onTestCaseResultUpdate,
  onTestUpdate,
  testSuite,
  showTableColumn,
  afterDeleteAction,
}: QualityTabProps) => {
  const { t } = useTranslation();
  const tabs = useMemo(
    () => [
      {
        label: t('label.test-case-plural'),
        key: EntityTabs.TEST_CASES,
        children: (
          <div className="p-t-md">
            <DataQualityTab
              afterDeleteAction={afterDeleteAction}
              isLoading={isLoading}
              showTableColumn={showTableColumn}
              testCases={testCases}
              onTestCaseResultUpdate={onTestCaseResultUpdate}
              onTestUpdate={onTestUpdate}
            />
          </div>
        ),
      },
      {
        label: t('label.pipeline'),
        key: EntityTabs.PIPELINE,
        children: <TestSuitePipelineTab testSuite={testSuite} />,
      },
    ],
    [isLoading, testCases, onTestUpdate, onTestCaseResultUpdate]
  );

  return (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <SummaryPanel
          testSummary={testSuite?.summary ?? INITIAL_TEST_SUMMARY}
        />
      </Col>
      <Col span={24}>
        <Tabs items={tabs} />
      </Col>
    </Row>
  );
};
