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
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  FormField,
  Grid,
  HintText,
  HookForm,
  Toggle,
  TreeSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import { Select } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isEqual, values } from 'lodash';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import {
  DEFAULT_PROFILER_CONFIG_VALUE,
  PROFILER_METRICS_TYPE_OPTIONS,
} from '../../constants/profiler.constant';
import {
  DataType,
  MetricConfigurationDefinition,
  MetricType,
  ProfilerConfiguration,
} from '../../generated/configuration/profilerConfiguration';
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  getTreeSelectValue,
  getTreeSelectValues,
  toTreeSelectNodes,
} from '../../utils/TreeSelect.utils';
import './profiler-configuration-page.style.less';
import profilerConfigurationClassBase from './ProfilerConfigurationClassBase';

const ProfilerConfigurationPage = () => {
  const form = useForm<ProfilerConfiguration>({
    defaultValues: DEFAULT_PROFILER_CONFIG_VALUE,
    mode: 'onChange',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'metricConfiguration',
  });
  const metricsOptions = useMemo(
    () => toTreeSelectNodes(PROFILER_METRICS_TYPE_OPTIONS),
    []
  );
  const fetchMetrics = useMemo(
    () => async () => ({ nodes: metricsOptions }),
    [metricsOptions]
  );
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.profiler-configuration')
      ),
    []
  );

  // Watchers
  const selectedMetricConfiguration = useWatch({
    control: form.control,
    name: 'metricConfiguration',
  });

  const dataTypeOptions = useMemo(() => {
    return values(DataType).map((value) => ({
      label: value,
      key: value,
      value,
      // Disable the metric type selection if the data type is already selected
      disabled: selectedMetricConfiguration?.some(
        (data) => data?.dataType === value
      ),
    }));
  }, [selectedMetricConfiguration]);

  const sparkAgentConfigComponent = useMemo(() => {
    const SparkAgentConfig =
      profilerConfigurationClassBase.getSparkAgentConfigComponent();

    return SparkAgentConfig ? (
      <Grid.Item className="layout-column" span={24}>
        <SparkAgentConfig />
      </Grid.Item>
    ) : null;
  }, []);

  const handleSubmit = async (data: ProfilerConfiguration) => {
    setIsFormSubmitting(true);
    const metricConfiguration = data.metricConfiguration?.map((item) => {
      if (isEqual(item.metrics, ['all'])) {
        return {
          ...item,
          metrics: values(MetricType),
        };
      }

      return item;
    });
    try {
      await updateSettingsConfig({
        config_type: SettingType.ProfilerConfiguration,
        config_value: {
          metricConfiguration,
          sampleDataConfig: data.sampleDataConfig,
        } as Settings['config_value'],
      });
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.profiler-configuration'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const fetchProfilerConfiguration = async () => {
    setIsLoading(true);
    try {
      const { data } = await getSettingsConfigFromConfigType(
        SettingType.ProfilerConfiguration
      );

      const configValue = data?.config_value as
        | ProfilerConfiguration
        | undefined;

      form.reset({
        metricConfiguration: isEmpty(configValue?.metricConfiguration)
          ? DEFAULT_PROFILER_CONFIG_VALUE.metricConfiguration
          : configValue?.metricConfiguration,
        sampleDataConfig:
          configValue?.sampleDataConfig ??
          DEFAULT_PROFILER_CONFIG_VALUE.sampleDataConfig,
      });
    } catch {
      // do nothing
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfilerConfiguration();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.profiler-configuration')}>
      <div className="m-b-mlg">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </div>
      <HookForm
        className="new-form-style"
        data-testid="profiler-config-form"
        form={form}
        id="profiler-config"
        onSubmit={form.handleSubmit(handleSubmit)}>
        <Grid
          className="layout-row layout-grid profiler-configuration-page-container"
          style={{ ...getLayoutGutter(0, 24) }}>
          <Grid.Item className="layout-column" span={24}>
            <PageHeader
              data={{
                header: t('label.profiler-configuration'),
                subHeader: t(
                  'message.page-sub-header-for-profiler-configuration'
                ),
              }}
              learningPageId={LEARNING_PAGE_IDS.PROFILER_CONFIGURATION}
              title={t('label.profiler-configuration')}
            />
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <Accordion
              allowsMultipleExpanded
              className="profiler-configuration-collapse"
              defaultExpandedKeys={new Set(['profileConfig'])}>
              <AccordionItem id="profileConfig" key="profileConfig">
                <AccordionHeader>
                  <PageHeader
                    data={{
                      header: t('label.metric-configuration'),
                      subHeader: t('message.metric-configuration-description'),
                    }}
                  />
                </AccordionHeader>
                <AccordionPanel>
                  <Grid
                    className="layout-row layout-grid"
                    style={{ ...getLayoutGutter(16, 16) }}>
                    <Grid.Item className="layout-column" span={10}>
                      {t('label.data-type')}
                      <Typography color="danger">*</Typography>
                    </Grid.Item>
                    <Grid.Item className="layout-column" span={11}>
                      {t('label.metric-type')}
                    </Grid.Item>
                    <Grid.Item className="layout-column" span={3}>
                      {t('label.disable')}
                    </Grid.Item>
                    {fields.map(({ id }, name) => (
                      <Fragment key={id}>
                        <Grid.Item className="layout-column" span={10}>
                          <FormField
                            control={form.control}
                            name={`metricConfiguration.${name}.dataType`}
                            rules={{
                              required: t('message.field-text-is-required', {
                                fieldText: t('label.data-type'),
                              }),
                            }}>
                            {({ field, fieldState }) => (
                              <>
                                <span className="tw:sr-only">
                                  {t('label.data-type')}
                                </span>
                                <Select
                                  {...field}
                                  allowClear
                                  showSearch
                                  data-testid="data-type-select"
                                  options={dataTypeOptions}
                                  placeholder={t('label.select-field', {
                                    field: t('label.data-type'),
                                  })}
                                  status={
                                    fieldState.error ? 'error' : undefined
                                  }
                                />
                                {fieldState.error && (
                                  <HintText isInvalid>
                                    {fieldState.error.message}
                                  </HintText>
                                )}
                              </>
                            )}
                          </FormField>
                        </Grid.Item>
                        <Grid.Item className="layout-column" span={11}>
                          <FormField
                            control={form.control}
                            name={`metricConfiguration.${name}.metrics`}>
                            {({ field, fieldState }) => (
                              <>
                                <span className="tw:sr-only" />
                                <TreeSelect
                                  cascadeSelection
                                  multiple
                                  searchable
                                  aria-label={t('label.metric-type')}
                                  data-testid="metric-type-select"
                                  disabled={
                                    selectedMetricConfiguration?.[name]
                                      ?.disabled
                                  }
                                  fetchData={fetchMetrics}
                                  maxVisibleItems={5}
                                  placeholder={t('label.select-field', {
                                    field: t('label.metric-type'),
                                  })}
                                  selectedDisplayStrategy="parent"
                                  value={getTreeSelectValue(
                                    metricsOptions,
                                    field.value
                                  )}
                                  onBlur={field.onBlur}
                                  onChange={(selection) =>
                                    field.onChange(
                                      getTreeSelectValues(selection)
                                    )
                                  }
                                />
                                {fieldState.error && (
                                  <HintText isInvalid>
                                    {fieldState.error.message}
                                  </HintText>
                                )}
                              </>
                            )}
                          </FormField>
                        </Grid.Item>
                        <Grid.Item
                          className="layout-column d-flex justify-between"
                          span={3}>
                          <FormField
                            control={form.control}
                            name={`metricConfiguration.${name}.disabled`}>
                            {({ field, fieldState }) => (
                              <>
                                <span className="tw:sr-only" />
                                <Toggle
                                  data-testid="disabled-switch"
                                  isSelected={!!field.value}
                                  onChange={field.onChange}
                                />
                                {fieldState.error && (
                                  <HintText isInvalid>
                                    {fieldState.error.message}
                                  </HintText>
                                )}
                              </>
                            )}
                          </FormField>
                          <div>
                            <Button
                              aria-label={t('label.remove')}
                              color="secondary"
                              data-testid={`remove-filter-${name}`}
                              iconLeading={<CloseOutlined />}
                              size="xs"
                              onClick={() => remove(name)}
                            />
                          </div>
                        </Grid.Item>
                      </Fragment>
                    ))}

                    <Grid.Item className="layout-column" span={24}>
                      <div className="matrix-collapse-footer">
                        <Button
                          color="tertiary"
                          data-testid="add-fields"
                          iconLeading={<PlusOutlined />}
                          onClick={() =>
                            append({} as MetricConfigurationDefinition)
                          }>
                          {t('label.add-new-field')}
                        </Button>
                      </div>
                    </Grid.Item>
                  </Grid>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Grid.Item>

          <Grid.Item className="layout-column" span={24}>
            <Accordion
              allowsMultipleExpanded
              className="profiler-configuration-collapse"
              defaultExpandedKeys={new Set(['sampleDataConfig'])}>
              <AccordionItem id="sampleDataConfig" key="sampleDataConfig">
                <AccordionHeader>
                  <PageHeader
                    data={{
                      header: t('label.sample-data-ingestion-configuration'),
                      subHeader: t(
                        'message.sample-data-ingestion-config-description'
                      ),
                    }}
                  />
                </AccordionHeader>
                <AccordionPanel>
                  <Grid
                    className="layout-row layout-grid"
                    data-testid="sample-data-ingestion-config"
                    style={{ ...getLayoutGutter(0, 24) }}>
                    <Grid.Item className="layout-column" span={24}>
                      <Box
                        align="center"
                        className="layout-row"
                        justify="between"
                        wrap="nowrap">
                        <Box
                          className="layout-column tw:block"
                          style={{ flex: 'auto' }}>
                          <Typography weight="semibold">
                            {t('label.enable-storing-of-sample-data')}
                          </Typography>
                          <Typography
                            as="p"
                            className="m-b-0"
                            color="secondary">
                            {t(
                              'message.enable-storing-sample-data-description'
                            )}
                          </Typography>
                        </Box>
                        <Box
                          className="layout-column tw:block p-l-lg"
                          style={{ flex: 'none' }}>
                          <FormField
                            control={form.control}
                            name="sampleDataConfig.storeSampleData">
                            {({ field, fieldState }) => (
                              <>
                                <span className="tw:sr-only" />
                                <Toggle
                                  data-testid="store-sample-data-switch"
                                  isSelected={!!field.value}
                                  onChange={(isSelected) => {
                                    field.onChange(isSelected);
                                    if (isSelected) {
                                      form.setValue(
                                        'sampleDataConfig.readSampleData',
                                        true,
                                        { shouldDirty: true }
                                      );
                                    }
                                  }}
                                />
                                {fieldState.error && (
                                  <HintText isInvalid>
                                    {fieldState.error.message}
                                  </HintText>
                                )}
                              </>
                            )}
                          </FormField>
                        </Box>
                      </Box>
                    </Grid.Item>
                    <Grid.Item className="layout-column" span={24}>
                      <Box
                        align="center"
                        className="layout-row"
                        justify="between"
                        wrap="nowrap">
                        <Box
                          className="layout-column tw:block"
                          style={{ flex: 'auto' }}>
                          <Typography weight="semibold">
                            {t('label.enable-reading-of-sample-data')}
                          </Typography>
                          <Typography
                            as="p"
                            className="m-b-0"
                            color="secondary">
                            {t(
                              'message.enable-reading-sample-data-description'
                            )}
                          </Typography>
                        </Box>
                        <Box
                          className="layout-column tw:block p-l-lg"
                          style={{ flex: 'none' }}>
                          <FormField
                            control={form.control}
                            name="sampleDataConfig.readSampleData">
                            {({ field, fieldState }) => (
                              <>
                                <span className="tw:sr-only" />
                                <Toggle
                                  data-testid="read-sample-data-switch"
                                  isSelected={!!field.value}
                                  onChange={field.onChange}
                                />
                                {fieldState.error && (
                                  <HintText isInvalid>
                                    {fieldState.error.message}
                                  </HintText>
                                )}
                              </>
                            )}
                          </FormField>
                        </Box>
                      </Box>
                    </Grid.Item>
                  </Grid>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Grid.Item>

          <Grid.Item className="layout-column" span={24}>
            <div className="d-flex justify-end gap-2">
              <Button
                color="secondary"
                data-testid="cancel-button"
                onClick={() => navigate(-1)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="save-button"
                isLoading={isFormSubmitting}
                type="submit">
                {t('label.save')}
              </Button>
            </div>
          </Grid.Item>

          {sparkAgentConfigComponent}
        </Grid>
      </HookForm>
    </PageLayoutV1>
  );
};

export default ProfilerConfigurationPage;
