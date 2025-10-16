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
import { useTranslation } from 'react-i18next';
import '../../../styles/variables.less';
import '../OverviewSection/OverviewSection.less';
import SectionWithEdit from '../SectionWithEdit/SectionWithEdit';
import './DataQualitySection.less';
interface DataQualityTest {
  type: 'success' | 'aborted' | 'failed';
  count: number;
}

interface DataQualitySectionProps {
  tests: DataQualityTest[];
  totalTests: number;
  onEdit?: () => void;
  showEditButton?: boolean;
  isDataQualityTab?: boolean;
}

const DataQualitySection: React.FC<DataQualitySectionProps> = ({
  tests,
  totalTests,
  onEdit,
  showEditButton = true,
  isDataQualityTab = false,
}) => {
  const { t } = useTranslation();

  // Calculate percentages for each test type
  const successTests =
    tests.find((test) => test.type === 'success')?.count || 0;
  const abortedTests =
    tests.find((test) => test.type === 'aborted')?.count || 0;
  const failedTests = tests.find((test) => test.type === 'failed')?.count || 0;

  const successPercent = totalTests > 0 ? (successTests / totalTests) * 100 : 0;
  const abortedPercent = totalTests > 0 ? (abortedTests / totalTests) * 100 : 0;
  const failedPercent = totalTests > 0 ? (failedTests / totalTests) * 100 : 0;

  return (
    <SectionWithEdit
      showEditButton={false}
      title={
        isDataQualityTab ? (
          <Typography.Text className="section-title mr-2">
            {t('label.test-plural')}
          </Typography.Text>
        ) : (
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
        )
      }
      onEdit={onEdit}>
      <div className="data-quality-content">
        <div className="data-quality-header" />

        {isDataQualityTab ? (
          <div className="overview-section gap-0">
            <div className="overview-row m-b-sm">
              <span className="overview-label" data-testid="all-label">
                {t('label.all')}
              </span>
              <span
                className="overview-value text-grey-body"
                data-testid="all-value">
                {totalTests}
              </span>
            </div>
            <div className="overview-row gap-0 m-b-sm">
              <Divider
                flexItem
                className="divider-color success"
                orientation="vertical"
                sx={{ borderRightWidth: '3px', marginRight: '8px' }}
              />
              <span className="overview-label" data-testid="success-label">
                {t('label.success')}
              </span>
              <span
                className="overview-value text-grey-body"
                data-testid="success-value">
                {successTests}
              </span>
            </div>
            <div className="overview-row gap-0 m-b-sm">
              <Divider
                flexItem
                className="divider-color aborted"
                orientation="vertical"
                sx={{ borderRightWidth: '3px', marginRight: '8px' }}
              />
              <span className="overview-label" data-testid="aborted-label">
                {t('label.aborted')}
              </span>
              <span
                className="overview-value text-grey-body"
                data-testid="aborted-value">
                {abortedTests}
              </span>
            </div>
            <div className="overview-row gap-0 m-b-sm">
              <Divider
                flexItem
                className="divider-color failed"
                orientation="vertical"
                sx={{
                  borderRightWidth: '3px',
                  marginRight: '8px',
                }}
              />
              <span className="overview-label" data-testid="failed-label">
                {t('label.failed')}
              </span>
              <span
                className="overview-value text-grey-body"
                data-testid="failed-value">
                {failedTests}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="data-quality-progress">
              <div className="data-quality-progress-segments">
                {successPercent > 0 && (
                  <div
                    className="progress-segment success"
                    style={{ width: `${successPercent}%` }}
                  />
                )}
                {abortedPercent > 0 && (
                  <div
                    className="progress-segment aborted"
                    style={{ width: `${abortedPercent}%` }}
                  />
                )}
                {failedPercent > 0 && (
                  <div
                    className="progress-segment failed"
                    style={{ width: `${failedPercent}%` }}
                  />
                )}
              </div>
            </div>

            <div className="data-quality-legend">
              {successTests > 0 && (
                <div className="legend-item">
                  <span className="legend-dot success" />
                  <span className="legend-text">
                    <Typography.Text className="legend-text-label">
                      {t('label.-with-colon', { text: t('label.success') })}{' '}
                    </Typography.Text>
                    <Typography.Text className="legend-text-value">
                      {successTests}
                    </Typography.Text>
                  </span>
                </div>
              )}
              {abortedTests > 0 && (
                <div className="legend-item">
                  <span className="legend-dot aborted" />
                  <span className="legend-text">
                    {t('label.-with-colon', { text: t('label.aborted') })}{' '}
                    {abortedTests}
                  </span>
                </div>
              )}
              {failedTests > 0 && (
                <div className="legend-item">
                  <span className="legend-dot failed" />
                  <span className="legend-text">
                    {t('label.-with-colon', { text: t('label.failed') })}{' '}
                    {failedTests}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SectionWithEdit>
  );
};

export default DataQualitySection;
