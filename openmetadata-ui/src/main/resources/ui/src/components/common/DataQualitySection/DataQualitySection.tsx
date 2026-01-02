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
import { Divider } from '@mui/material';
import { Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/variables.less';
import SectionWithEdit from '../SectionWithEdit/SectionWithEdit';
import { DataQualityLegendItem } from './DataQualityLegendItem';
import { DataQualityProgressSegment } from './DataQualityProgressSegment';
import { DataQualitySectionProps } from './DataQualitySection.interface';
import './DataQualitySection.less';
import { DataQualityStatCard } from './DataQualityStatCard';

const DataQualitySection: React.FC<DataQualitySectionProps> = ({
  tests,
  totalTests,
  onEdit,
  isDataQualityTab = false,
  activeFilter = 'success',
  onFilterChange,
}) => {
  const { t } = useTranslation();

  // Calculate percentages for each test type
  const {
    successTests,
    abortedTests,
    failedTests,
    successPercent,
    abortedPercent,
    failedPercent,
  } = useMemo(() => {
    const successTests =
      tests.find((test) => test.type === 'success')?.count || 0;
    const abortedTests =
      tests.find((test) => test.type === 'aborted')?.count || 0;
    const failedTests =
      tests.find((test) => test.type === 'failed')?.count || 0;

    const successPercent =
      totalTests > 0 ? (successTests / totalTests) * 100 : 0;
    const abortedPercent =
      totalTests > 0 ? (abortedTests / totalTests) * 100 : 0;
    const failedPercent = totalTests > 0 ? (failedTests / totalTests) * 100 : 0;

    return {
      successTests,
      abortedTests,
      failedTests,
      successPercent,
      abortedPercent,
      failedPercent,
    };
  }, [tests, totalTests]);

  return isDataQualityTab ? (
    <div className="data-quality-stats-container">
      <DataQualityStatCard
        count={successTests}
        isActive={activeFilter === 'success'}
        label={t('label.passed')}
        type="success"
        onClick={() => onFilterChange?.('success')}
      />
      <Divider
        flexItem
        className="stat-card-vertical-divider"
        orientation="vertical"
        variant="middle"
      />
      <DataQualityStatCard
        count={abortedTests}
        isActive={activeFilter === 'aborted'}
        label={t('label.aborted')}
        type="aborted"
        onClick={() => onFilterChange?.('aborted')}
      />
      <Divider
        flexItem
        className="stat-card-vertical-divider"
        orientation="vertical"
        variant="middle"
      />
      <DataQualityStatCard
        count={failedTests}
        isActive={activeFilter === 'failed'}
        label={t('label.failed')}
        type="failed"
        onClick={() => onFilterChange?.('failed')}
      />
    </div>
  ) : (
    <SectionWithEdit
      showEditButton={false}
      title={
        <div className="d-flex">
          <Typography.Text className="section-title mr-2">
            {t('label.data-quality-test-plural')}
          </Typography.Text>
          <div className="data-quality-badge">
            <Typography.Text className="data-quality-badge-text">
              {totalTests}
            </Typography.Text>
          </div>
        </div>
      }
      onEdit={onEdit}>
      {totalTests === 0 ? (
        <>
          <div className="data-quality-section">
            <span className="no-data-placeholder">
              {t('label.no-tests-run')}
            </span>
          </div>
        </>
      ) : (
        <div className="data-quality-content">
          <div className="data-quality-header" />
          <div className="data-quality-progress">
            <div className="data-quality-progress-segments">
              <DataQualityProgressSegment
                percent={successPercent}
                type="success"
              />
              <DataQualityProgressSegment
                percent={abortedPercent}
                type="aborted"
              />
              <DataQualityProgressSegment
                percent={failedPercent}
                type="failed"
              />
            </div>
          </div>

          <div className="data-quality-legend">
            <DataQualityLegendItem
              count={successTests}
              label={t('label.-with-colon', { text: t('label.success') })}
              type="success"
            />
            <DataQualityLegendItem
              count={abortedTests}
              label={t('label.-with-colon', { text: t('label.aborted') })}
              type="aborted"
            />
            <DataQualityLegendItem
              count={failedTests}
              label={t('label.-with-colon', { text: t('label.failed') })}
              type="failed"
            />
          </div>
        </div>
      )}
    </SectionWithEdit>
  );
};

export default DataQualitySection;
