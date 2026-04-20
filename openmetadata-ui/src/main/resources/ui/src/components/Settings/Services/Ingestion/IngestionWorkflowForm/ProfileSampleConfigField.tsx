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

import {
  Button,
  Card,
  Grid,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { FieldProps } from '@rjsf/utils';
import { Plus, Trash01 } from '@untitledui/icons';
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

const SAMPLE_CONFIG_TYPE_OPTIONS = [
  { id: SampleConfigType.Static, label: 'STATIC' },
  { id: SampleConfigType.Dynamic, label: 'DYNAMIC' },
];

const PROFILE_SAMPLE_TYPE_OPTIONS = [
  { id: ProfileSampleType.Percentage, label: 'PERCENTAGE' },
  { id: ProfileSampleType.Rows, label: 'ROWS' },
];

const SAMPLING_METHOD_TYPE_OPTIONS = [
  { id: SamplingMethodType.Bernoulli, label: 'BERNOULLI' },
  { id: SamplingMethodType.System, label: 'SYSTEM' },
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
    (type: string | number | null) => {
      const newConfig: ICSamplingConfig =
        type === SampleConfigType.Dynamic ? { thresholds: [] } : {};
      onChange({
        sampleConfigType: type as SampleConfigType,
        config: newConfig,
      });
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
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Typography size="text-sm">{t('label.sample-config-type')}</Typography>
        <Select
          className="w-full"
          data-testid="sample-config-type-select"
          fontSize="sm"
          items={SAMPLE_CONFIG_TYPE_OPTIONS}
          value={sampleConfigType}
          onChange={handleConfigTypeChange}>
          {(item) => (
            <Select.Item id={item.id} key={item.id}>
              <Typography size="text-sm">{item.label}</Typography>
            </Select.Item>
          )}
        </Select>
      </div>

      {sampleConfigType === SampleConfigType.Static && (
        <Grid className="m-t-sm" colGap="4" rowGap="2">
          <Grid.Item span={12}>
            <div className="tw:flex tw:flex-col tw:gap-1">
              <Typography size="text-sm">
                {t('label.profile-sample')}
              </Typography>
              <Input
                className="w-full"
                data-testid="profile-sample-input"
                type="number"
                value={config.profileSample?.toString() ?? ''}
                onChange={(value) =>
                  handleStaticFieldChange(
                    'profileSample',
                    value !== '' ? Number(value) : undefined
                  )
                }
              />
            </div>
          </Grid.Item>
          <Grid.Item span={12}>
            <div className="tw:flex tw:flex-col tw:gap-1">
              <Typography size="text-sm">
                {t('label.profile-sample-type')}
              </Typography>
              <Select
                className="w-full"
                data-testid="profile-sample-type-select"
                fontSize="sm"
                items={PROFILE_SAMPLE_TYPE_OPTIONS}
                value={config.profileSampleType ?? null}
                onChange={(value) =>
                  handleStaticFieldChange(
                    'profileSampleType',
                    value as ProfileSampleType
                  )
                }>
                {(item) => (
                  <Select.Item id={item.id} key={item.id}>
                    <Typography size="text-sm">{item.label}</Typography>
                  </Select.Item>
                )}
              </Select>
            </div>
          </Grid.Item>
          <Grid.Item span={12}>
            <div className="tw:flex tw:flex-col tw:gap-1">
              <Typography size="text-sm">
                {t('label.sampling-method-type')}
              </Typography>
              <Select
                className="w-full"
                data-testid="sampling-method-type-select"
                fontSize="sm"
                items={SAMPLING_METHOD_TYPE_OPTIONS}
                value={config.samplingMethodType ?? null}
                onChange={(value) =>
                  handleStaticFieldChange(
                    'samplingMethodType',
                    value as SamplingMethodType
                  )
                }>
                {(item) => (
                  <Select.Item id={item.id} key={item.id}>
                    <Typography size="text-sm">{item.label}</Typography>
                  </Select.Item>
                )}
              </Select>
            </div>
          </Grid.Item>
        </Grid>
      )}

      {sampleConfigType === SampleConfigType.Dynamic && (
        <div className="m-t-sm">
          <Typography
            className="m-b-xs tw:block"
            size="text-sm"
            weight="medium">
            {t('label.threshold-plural')}
          </Typography>
          {(config.thresholds ?? []).map((threshold, index) => (
            <Card className="m-b-sm" key={index} size="sm">
              <Card.Header
                extra={
                  <Button
                    color="tertiary-destructive"
                    data-testid={`remove-threshold-${index}`}
                    iconLeading={Trash01}
                    size="sm"
                    onClick={() => handleRemoveThreshold(index)}
                  />
                }
                title={`${t('label.threshold')} ${index + 1}`}
              />
              <Card.Content>
                <Grid colGap="4" rowGap="2">
                  <Grid.Item span={12}>
                    <div className="tw:flex tw:flex-col tw:gap-1">
                      <Typography size="text-sm">
                        {t('label.row-count-threshold')}
                      </Typography>
                      <Input
                        className="w-full"
                        data-testid={`row-count-threshold-${index}`}
                        type="number"
                        value={threshold.rowCountThreshold.toString()}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'rowCountThreshold',
                            Number(value) || 1
                          )
                        }
                      />
                    </div>
                  </Grid.Item>
                  <Grid.Item span={12}>
                    <div className="tw:flex tw:flex-col tw:gap-1">
                      <Typography size="text-sm">
                        {t('label.profile-sample')}
                      </Typography>
                      <Input
                        className="w-full"
                        data-testid={`profile-sample-${index}`}
                        type="number"
                        value={threshold.profileSample.toString()}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'profileSample',
                            Number(value) || 0
                          )
                        }
                      />
                    </div>
                  </Grid.Item>
                  <Grid.Item span={12}>
                    <div className="tw:flex tw:flex-col tw:gap-1">
                      <Typography size="text-sm">
                        {t('label.profile-sample-type')}
                      </Typography>
                      <Select
                        className="w-full"
                        data-testid={`profile-sample-type-${index}`}
                        fontSize="sm"
                        items={PROFILE_SAMPLE_TYPE_OPTIONS}
                        value={threshold.profileSampleType ?? null}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'profileSampleType',
                            value as ProfileSampleType
                          )
                        }>
                        {(item) => (
                          <Select.Item id={item.id} key={item.id}>
                            <Typography size="text-sm">{item.label}</Typography>
                          </Select.Item>
                        )}
                      </Select>
                    </div>
                  </Grid.Item>
                  <Grid.Item span={12}>
                    <div className="tw:flex tw:flex-col tw:gap-1">
                      <Typography size="text-sm">
                        {t('label.sampling-method-type')}
                      </Typography>
                      <Select
                        className="w-full"
                        data-testid={`sampling-method-type-${index}`}
                        fontSize="sm"
                        items={SAMPLING_METHOD_TYPE_OPTIONS}
                        value={threshold.samplingMethodType ?? null}
                        onChange={(value) =>
                          handleThresholdChange(
                            index,
                            'samplingMethodType',
                            value as SamplingMethodType
                          )
                        }>
                        {(item) => (
                          <Select.Item id={item.id} key={item.id}>
                            <Typography size="text-sm">{item.label}</Typography>
                          </Select.Item>
                        )}
                      </Select>
                    </div>
                  </Grid.Item>
                </Grid>
              </Card.Content>
            </Card>
          ))}
          <Button
            color="secondary"
            data-testid="add-threshold-btn"
            iconLeading={Plus}
            size="sm"
            onClick={handleAddThreshold}>
            {t('label.add-entity', { entity: t('label.threshold') })}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileSampleConfigField;
