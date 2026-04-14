/*
 *  Copyright 2026 Collate.
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

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { FieldProps } from '@rjsf/utils';
import { Button, Card, Col, InputNumber, Row, Select, Typography } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ICSamplingConfig,
  ProfileSampleConfig,
  ProfileSampleType,
  SampleConfigType,
  SamplingMethodType,
  Threshold,
} from '../../../../../generated/metadataIngestion/databaseServiceProfilerPipeline';

const { Text } = Typography;

const SAMPLE_CONFIG_TYPE_OPTIONS = [
  { label: 'STATIC', value: SampleConfigType.Static },
  { label: 'DYNAMIC', value: SampleConfigType.Dynamic },
];

const PROFILE_SAMPLE_TYPE_OPTIONS = [
  { label: 'PERCENTAGE', value: ProfileSampleType.Percentage },
  { label: 'ROWS', value: ProfileSampleType.Rows },
];

const SAMPLING_METHOD_TYPE_OPTIONS = [
  { label: 'BERNOULLI', value: SamplingMethodType.Bernoulli },
  { label: 'SYSTEM', value: SamplingMethodType.System },
];

const DEFAULT_THRESHOLD: Threshold = {
  rowCountThreshold: 1,
  profileSample: 100,
};

const ProfileSampleConfigField = (props: FieldProps<ProfileSampleConfig>) => {
  const { formData, onChange } = props;
  const { t } = useTranslation();

  const sampleConfigType =
    formData?.sampleConfigType ?? SampleConfigType.Static;
  const config: ICSamplingConfig = formData?.config ?? {};

  const handleConfigTypeChange = useCallback(
    (type: SampleConfigType) => {
      const newConfig: ICSamplingConfig =
        type === SampleConfigType.Dynamic ? { thresholds: [] } : {};
      onChange({ sampleConfigType: type, config: newConfig });
    },
    [onChange]
  );

  const handleStaticFieldChange = useCallback(
    (
      field: keyof ICSamplingConfig,
      value: ICSamplingConfig[keyof ICSamplingConfig]
    ) => {
      onChange({ sampleConfigType, config: { ...config, [field]: value } });
    },
    [sampleConfigType, config, onChange]
  );

  const handleThresholdChange = useCallback(
    (
      index: number,
      field: keyof Threshold,
      value: Threshold[keyof Threshold]
    ) => {
      const thresholds = [...(config.thresholds ?? [])];
      thresholds[index] = { ...thresholds[index], [field]: value };
      onChange({ sampleConfigType, config: { thresholds } });
    },
    [sampleConfigType, config, onChange]
  );

  const handleAddThreshold = useCallback(() => {
    const thresholds = [...(config.thresholds ?? []), { ...DEFAULT_THRESHOLD }];
    onChange({ sampleConfigType, config: { thresholds } });
  }, [sampleConfigType, config, onChange]);

  const handleRemoveThreshold = useCallback(
    (index: number) => {
      const thresholds = (config.thresholds ?? []).filter(
        (_, i) => i !== index
      );
      onChange({ sampleConfigType, config: { thresholds } });
    },
    [sampleConfigType, config, onChange]
  );

  return (
    <div className="profile-sample-config-field">
      <Row gutter={[0, 8]}>
        <Col span={24}>
          <Text className="text-sm">{t('label.sample-config-type')}</Text>
        </Col>
        <Col span={24}>
          <Select
            className="w-full"
            data-testid="sample-config-type-select"
            options={SAMPLE_CONFIG_TYPE_OPTIONS}
            value={sampleConfigType}
            onChange={handleConfigTypeChange}
          />
        </Col>
      </Row>

      {sampleConfigType === SampleConfigType.Static && (
        <Row className="m-t-sm" gutter={[16, 8]}>
          <Col span={12}>
            <Row gutter={[0, 4]}>
              <Col span={24}>
                <Text className="text-sm">{t('label.profile-sample')}</Text>
              </Col>
              <Col span={24}>
                <InputNumber
                  className="w-full"
                  data-testid="profile-sample-input"
                  min={0}
                  value={config.profileSample ?? undefined}
                  onChange={(value) =>
                    handleStaticFieldChange('profileSample', value ?? undefined)
                  }
                />
              </Col>
            </Row>
          </Col>
          <Col span={12}>
            <Row gutter={[0, 4]}>
              <Col span={24}>
                <Text className="text-sm">
                  {t('label.profile-sample-type')}
                </Text>
              </Col>
              <Col span={24}>
                <Select
                  className="w-full"
                  data-testid="profile-sample-type-select"
                  options={PROFILE_SAMPLE_TYPE_OPTIONS}
                  value={config.profileSampleType}
                  onChange={(value) =>
                    handleStaticFieldChange('profileSampleType', value)
                  }
                />
              </Col>
            </Row>
          </Col>
          <Col span={12}>
            <Row gutter={[0, 4]}>
              <Col span={24}>
                <Text className="text-sm">
                  {t('label.sampling-method-type')}
                </Text>
              </Col>
              <Col span={24}>
                <Select
                  className="w-full"
                  data-testid="sampling-method-type-select"
                  options={SAMPLING_METHOD_TYPE_OPTIONS}
                  value={config.samplingMethodType}
                  onChange={(value) =>
                    handleStaticFieldChange('samplingMethodType', value)
                  }
                />
              </Col>
            </Row>
          </Col>
        </Row>
      )}

      {sampleConfigType === SampleConfigType.Dynamic && (
        <div className="m-t-sm">
          <Row className="m-b-xs" gutter={[0, 4]}>
            <Col span={24}>
              <Text className="text-sm font-medium">
                {t('label.threshold-plural')}
              </Text>
            </Col>
          </Row>
          {(config.thresholds ?? []).map((threshold, index) => (
            <Card
              className="m-b-sm"
              extra={
                <Button
                  data-testid={`remove-threshold-${index}`}
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                  onClick={() => handleRemoveThreshold(index)}
                />
              }
              key={index}
              size="small"
              title={`${t('label.threshold')} ${index + 1}`}>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Row gutter={[0, 4]}>
                    <Col span={24}>
                      <Text className="text-sm">
                        {t('label.row-count-threshold')}
                      </Text>
                    </Col>
                    <Col span={24}>
                      <InputNumber
                        className="w-full"
                        data-testid={`row-count-threshold-${index}`}
                        min={1}
                        value={threshold.rowCountThreshold}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'rowCountThreshold',
                            value ?? 1
                          )
                        }
                      />
                    </Col>
                  </Row>
                </Col>
                <Col span={12}>
                  <Row gutter={[0, 4]}>
                    <Col span={24}>
                      <Text className="text-sm">
                        {t('label.profile-sample')}
                      </Text>
                    </Col>
                    <Col span={24}>
                      <InputNumber
                        className="w-full"
                        data-testid={`profile-sample-${index}`}
                        min={0}
                        value={threshold.profileSample}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'profileSample',
                            value ?? 0
                          )
                        }
                      />
                    </Col>
                  </Row>
                </Col>
                <Col span={12}>
                  <Row gutter={[0, 4]}>
                    <Col span={24}>
                      <Text className="text-sm">
                        {t('label.profile-sample-type')}
                      </Text>
                    </Col>
                    <Col span={24}>
                      <Select
                        className="w-full"
                        data-testid={`profile-sample-type-${index}`}
                        options={PROFILE_SAMPLE_TYPE_OPTIONS}
                        value={threshold.profileSampleType}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'profileSampleType',
                            value
                          )
                        }
                      />
                    </Col>
                  </Row>
                </Col>
                <Col span={12}>
                  <Row gutter={[0, 4]}>
                    <Col span={24}>
                      <Text className="text-sm">
                        {t('label.sampling-method-type')}
                      </Text>
                    </Col>
                    <Col span={24}>
                      <Select
                        className="w-full"
                        data-testid={`sampling-method-type-${index}`}
                        options={SAMPLING_METHOD_TYPE_OPTIONS}
                        value={threshold.samplingMethodType}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'samplingMethodType',
                            value
                          )
                        }
                      />
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Card>
          ))}
          <Button
            data-testid="add-threshold-btn"
            icon={<PlusOutlined />}
            size="small"
            type="dashed"
            onClick={handleAddThreshold}>
            {t('label.add-entity', { entity: t('label.threshold') })}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileSampleConfigField;
