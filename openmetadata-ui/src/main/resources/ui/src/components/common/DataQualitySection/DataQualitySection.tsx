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
import { Badge, Progress, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
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
}

const DataQualitySection: React.FC<DataQualitySectionProps> = ({
  tests,
  totalTests,
  onEdit,
  showEditButton = true,
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

  // Create strokeColor object for Ant Design Progress component
  const strokeColor = {
    '0%': '#52C41A',
    [`${successPercent}%`]: '#52C41A',
    [`${successPercent}%`]: '#FAAD14',
    [`${successPercent + abortedPercent}%`]: '#FAAD14',
    [`${successPercent + abortedPercent}%`]: '#F5222D',
    '100%': '#F5222D',
  };

  return (
    <SectionWithEdit
      showEditButton={false}
      title={
        <div className="d-flex">
          <Typography.Text className="section-title mr-2">
            {t('label.data-quality-test-plural')}
          </Typography.Text>
          <Badge
            className="data-quality-badge"
            color="#F9FAFC"
            count={totalTests}
            style={{
              color: '#364254',
              marginLeft: '8px',
              fontWeight: 500,
              fontSize: '10px',
            }}
          />
        </div>
      }
      onEdit={onEdit}>
      <div className="data-quality-content">
        <div className="data-quality-header" />

        <div className="data-quality-progress">
          <Progress
            className="data-quality-progress-bar"
            percent={100}
            showInfo={false}
            strokeColor={strokeColor}
            strokeWidth={8}
          />
        </div>

        <div className="data-quality-legend">
          {successTests > 0 && (
            <div className="legend-item">
              <span className="legend-dot success" />
              <span className="legend-text">
                {t('label.success')} <strong>{successTests}</strong>
              </span>
            </div>
          )}
          {abortedTests > 0 && (
            <div className="legend-item">
              <span className="legend-dot aborted" />
              <span className="legend-text">
                {t('label.aborted')} <strong>{abortedTests}</strong>
              </span>
            </div>
          )}
          {failedTests > 0 && (
            <div className="legend-item">
              <span className="legend-dot failed" />
              <span className="legend-text">
                {t('label.failed')} <strong>{failedTests}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </SectionWithEdit>
  );
};

export default DataQualitySection;
