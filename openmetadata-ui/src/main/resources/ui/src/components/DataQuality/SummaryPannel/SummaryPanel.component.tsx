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
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import TestCaseAbortedIcon from '../../../assets/svg/aborted-status.svg?react';
import TestCaseIcon from '../../../assets/svg/all-activity-v2.svg?react';
import TestCaseFailedIcon from '../../../assets/svg/failed-status.svg?react';
import DataAssetsCoverageIcon from '../../../assets/svg/ic-data-assets-coverage.svg?react';
import HealthCheckIcon from '../../../assets/svg/ic-green-heart-border.svg?react';
import TestCaseSuccessIcon from '../../../assets/svg/success-colored.svg?react';
import { SummaryCard } from '../../../components/common/SummaryCard/SummaryCard.component';
import { PRIMARY_COLOR, YELLOW_2 } from '../../../constants/Color.constants';
import { SummaryPanelProps } from './SummaryPanel.interface';

export const SummaryPanel: FC<SummaryPanelProps> = ({
  testSummary: summary,
  isLoading = false,
  showAdditionalSummary = false,
}: SummaryPanelProps) => {
  const { t } = useTranslation();
  const spanValue = useMemo(
    () => (showAdditionalSummary ? 8 : 6),
    [showAdditionalSummary]
  );

  return (
    <Row wrap gutter={[16, 16]}>
      <Col span={spanValue}>
        <SummaryCard
          inverseLabel
          cardBackgroundClass="bg-primary"
          className="h-full"
          isLoading={isLoading}
          showProgressBar={false}
          title={t('label.total-entity', { entity: t('label.test-plural') })}
          titleIcon={
            <TestCaseIcon color={PRIMARY_COLOR} height={16} width={16} />
          }
          total={summary?.total ?? 0}
          value={summary?.total ?? 0}
        />
      </Col>
      <Col span={spanValue}>
        <SummaryCard
          inverseLabel
          cardBackgroundClass="bg-success"
          isLoading={isLoading}
          title={t('label.success')}
          titleIcon={<TestCaseSuccessIcon height={16} width={16} />}
          total={summary?.total ?? 0}
          type="success"
          value={summary?.success ?? 0}
        />
      </Col>
      <Col span={spanValue}>
        <SummaryCard
          inverseLabel
          cardBackgroundClass="bg-aborted"
          isLoading={isLoading}
          title={t('label.aborted')}
          titleIcon={
            <TestCaseAbortedIcon color={YELLOW_2} height={16} width={16} />
          }
          total={summary?.total ?? 0}
          type="aborted"
          value={summary?.aborted ?? 0}
        />
      </Col>
      <Col span={spanValue}>
        <SummaryCard
          inverseLabel
          cardBackgroundClass="bg-failed"
          isLoading={isLoading}
          title={t('label.failed')}
          titleIcon={<TestCaseFailedIcon height={16} width={16} />}
          total={summary?.total ?? 0}
          type="failed"
          value={summary?.failed ?? 0}
        />
      </Col>
      {showAdditionalSummary && (
        <>
          <Col span={spanValue}>
            <SummaryCard
              inverseLabel
              cardBackgroundClass="bg-success"
              isLoading={isLoading}
              title={t('label.healthy-data-asset-plural')}
              titleIcon={<HealthCheckIcon height={16} width={16} />}
              total={summary?.totalDQEntities ?? 0}
              type="success"
              value={summary?.healthy ?? 0}
            />
          </Col>
          <Col span={spanValue}>
            <SummaryCard
              inverseLabel
              cardBackgroundClass="bg-primary"
              isLoading={isLoading}
              title={t('label.data-asset-plural-coverage')}
              titleIcon={<DataAssetsCoverageIcon height={16} width={16} />}
              total={summary?.totalEntityCount ?? 0}
              type="acknowledged"
              value={summary?.totalDQEntities ?? 0}
            />
          </Col>
        </>
      )}
    </Row>
  );
};
