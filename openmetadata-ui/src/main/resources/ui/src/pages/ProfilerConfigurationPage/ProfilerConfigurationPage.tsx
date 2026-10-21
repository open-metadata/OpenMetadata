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
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  HookForm,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ProfilerColumnSelect } from '../../components/Database/Profiler/TableProfiler/ProfilerSettingsModal/ProfilerColumnSelect';
import { ProfilerMetricSelect } from '../../components/Database/Profiler/TableProfiler/ProfilerSettingsModal/ProfilerMetricSelect';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { MetricType } from '../../generated/configuration/profilerConfiguration';
import { SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import profilerConfigurationClassBase from './ProfilerConfigurationClassBase';
import {
  getDataTypeItems,
  getProfilerConfigurationPayload,
  getProfilerConfigurationValues,
  getSelectedDataType,
  ProfilerConfigurationValues,
} from './ProfilerConfigurationPage.utils';

const METRIC_OPTIONS = Object.values(MetricType);
const ProfilerConfigurationPage = () => {
  const form = useForm<ProfilerConfigurationValues>({
    defaultValues: getProfilerConfigurationValues(),
  });
  const { control, reset, setValue } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metricConfiguration',
  });
  const metricConfiguration = useWatch({
    control,
    name: 'metricConfiguration',
  });
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const { t } = useTranslation();
  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.profiler-configuration')
      ),
    [t]
  );
  const SparkAgentConfig =
    profilerConfigurationClassBase.getSparkAgentConfigComponent();

  useEffect(() => {
    let active = true;
    const fetchConfiguration = async () => {
      try {
        const { data } = await getSettingsConfigFromConfigType(
          SettingType.ProfilerConfiguration
        );
        if (active) {
          reset(getProfilerConfigurationValues(data?.config_value));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchConfiguration().catch(() => setIsLoading(false));

    return () => {
      active = false;
    };
  }, [reset]);

  const handleSubmit = async (data: ProfilerConfigurationValues) => {
    setIsFormSubmitting(true);
    try {
      await updateSettingsConfig({
        config_type: SettingType.ProfilerConfiguration,
        config_value: getProfilerConfigurationPayload(data),
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
  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.profiler-configuration')}>
      <Box className="tw:mb-4">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </Box>
      <Card className="tw:mt-4 tw:rounded tw:border-0">
        <Card.Content className="tw:p-5">
          <FormProvider {...form}>
            <HookForm
              data-testid="profiler-config-form"
              form={form}
              id="profiler-config"
              validationBehavior="aria"
              onSubmit={form.handleSubmit(handleSubmit)}>
              <Box direction="col" gap={6}>
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
                <Accordion defaultExpandedKeys={['profileConfig']}>
                  <AccordionItem id="profileConfig">
                    <AccordionHeader className="tw:bg-secondary_subtle tw:px-4">
                      <Box direction="col" gap={1}>
                        <Typography size="text-sm" weight="semibold">
                          {t('label.metric-configuration')}
                        </Typography>
                        <Typography
                          color="secondary"
                          size="text-sm"
                          weight="regular">
                          {t('message.metric-configuration-description')}
                        </Typography>
                      </Box>
                    </AccordionHeader>
                    <AccordionPanel className="tw:p-6">
                      <Grid colGap="4" rowGap="4">
                        <Grid.Item span={10}>
                          <Typography>
                            {t('label.data-type')}
                            <Typography as="span" color="danger">
                              *
                            </Typography>
                          </Typography>
                        </Grid.Item>
                        <Grid.Item span={11}>
                          {t('label.metric-type')}
                        </Grid.Item>
                        <Grid.Item span={3}>{t('label.disable')}</Grid.Item>
                        {fields.map((row, index) => (
                          <Fragment key={row.id}>
                            <Grid.Item
                              data-testid={`profiler-data-type-${index}`}
                              span={10}>
                              <Controller
                                control={control}
                                name={`metricConfiguration.${index}.dataType`}
                                render={({ field, fieldState }) => (
                                  <Box direction="col" gap={1}>
                                    <ProfilerColumnSelect
                                      isDisabled={false}
                                      isInvalid={Boolean(fieldState.error)}
                                      items={getDataTypeItems(
                                        metricConfiguration,
                                        index
                                      )}
                                      label={t('label.data-type')}
                                      placeholder={t('label.select-field', {
                                        field: t('label.data-type'),
                                      })}
                                      selectedKey={field.value ?? null}
                                      testId="data-type-select"
                                      onBlur={field.onBlur}
                                      onSelectionChange={(key) =>
                                        field.onChange(getSelectedDataType(key))
                                      }
                                    />
                                    {fieldState.error && (
                                      <Typography color="danger" size="text-sm">
                                        {fieldState.error.message}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                                rules={{
                                  required: t(
                                    'message.field-text-is-required',
                                    { fieldText: t('label.data-type') }
                                  ),
                                }}
                              />
                            </Grid.Item>
                            <Grid.Item
                              data-testid={`profiler-metrics-${index}`}
                              span={11}>
                              <Controller
                                control={control}
                                name={`metricConfiguration.${index}.metrics`}
                                render={({ field }) => (
                                  <ProfilerMetricSelect
                                    isDisabled={
                                      metricConfiguration[index]?.disabled
                                    }
                                    label={t('label.metric-type')}
                                    maxVisible={5}
                                    options={METRIC_OPTIONS}
                                    placeholder={t('label.select-field', {
                                      field: t('label.metric-type'),
                                    })}
                                    testId="metric-type-select"
                                    value={field.value}
                                    onChange={field.onChange}
                                  />
                                )}
                              />
                            </Grid.Item>
                            <Grid.Item
                              data-testid={`profiler-disabled-${index}`}
                              span={3}>
                              <Box align="center" gap={2} justify="between">
                                <Controller
                                  control={control}
                                  name={`metricConfiguration.${index}.disabled`}
                                  render={({ field }) => (
                                    <Toggle
                                      aria-label={t('label.disable')}
                                      data-testid="disabled-switch"
                                      isSelected={field.value ?? false}
                                      onChange={field.onChange}
                                    />
                                  )}
                                />
                                <Button
                                  aria-label={t('label.remove-entity', {
                                    entity: t('label.field'),
                                  })}
                                  color="secondary"
                                  data-testid={`remove-filter-${index}`}
                                  iconLeading={XClose}
                                  size="xs"
                                  onClick={() => remove(index)}
                                />
                              </Box>
                            </Grid.Item>
                          </Fragment>
                        ))}
                        <Grid.Item span={24}>
                          <Box direction="col" gap={6}>
                            <Divider />
                            <Box>
                              <Button
                                color="link-color"
                                data-testid="add-fields"
                                iconLeading={Plus}
                                size="sm"
                                onClick={() => append({})}>
                                {t('label.add-new-field')}
                              </Button>
                            </Box>
                          </Box>
                        </Grid.Item>
                      </Grid>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
                <Accordion defaultExpandedKeys={['sampleDataConfig']}>
                  <AccordionItem id="sampleDataConfig">
                    <AccordionHeader className="tw:bg-secondary_subtle tw:px-4">
                      <Box direction="col" gap={1}>
                        <Typography size="text-sm" weight="semibold">
                          {t('label.sample-data-ingestion-configuration')}
                        </Typography>
                        <Typography
                          color="secondary"
                          size="text-sm"
                          weight="regular">
                          {t(
                            'message.sample-data-ingestion-config-description'
                          )}
                        </Typography>
                      </Box>
                    </AccordionHeader>
                    <AccordionPanel className="tw:p-6">
                      <Box
                        data-testid="sample-data-ingestion-config"
                        direction="col"
                        gap={6}>
                        <Box align="center" gap={6} justify="between">
                          <Box direction="col">
                            <Typography weight="semibold">
                              {t('label.enable-storing-of-sample-data')}
                            </Typography>
                            <Typography color="secondary">
                              {t(
                                'message.enable-storing-sample-data-description'
                              )}
                            </Typography>
                          </Box>
                          <Controller
                            control={control}
                            name="sampleDataConfig.storeSampleData"
                            render={({ field }) => (
                              <Toggle
                                aria-label={t(
                                  'label.enable-storing-of-sample-data'
                                )}
                                data-testid="store-sample-data-switch"
                                isSelected={field.value ?? false}
                                onChange={(selected) => {
                                  field.onChange(selected);
                                  if (selected) {
                                    setValue(
                                      'sampleDataConfig.readSampleData',
                                      true
                                    );
                                  }
                                }}
                              />
                            )}
                          />
                        </Box>
                        <Box align="center" gap={6} justify="between">
                          <Box direction="col">
                            <Typography weight="semibold">
                              {t('label.enable-reading-of-sample-data')}
                            </Typography>
                            <Typography color="secondary">
                              {t(
                                'message.enable-reading-sample-data-description'
                              )}
                            </Typography>
                          </Box>
                          <Controller
                            control={control}
                            name="sampleDataConfig.readSampleData"
                            render={({ field }) => (
                              <Toggle
                                aria-label={t(
                                  'label.enable-reading-of-sample-data'
                                )}
                                data-testid="read-sample-data-switch"
                                isSelected={field.value ?? false}
                                onChange={field.onChange}
                              />
                            )}
                          />
                        </Box>
                      </Box>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
                <Box gap={2} justify="end">
                  <Button
                    color="secondary"
                    data-testid="cancel-button"
                    size="md"
                    onClick={() => navigate(-1)}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    data-testid="save-button"
                    isLoading={isFormSubmitting}
                    size="md"
                    type="submit">
                    {t('label.save')}
                  </Button>
                </Box>
              </Box>
            </HookForm>
          </FormProvider>
          {SparkAgentConfig && (
            <Box className="tw:mt-6">
              <SparkAgentConfig />
            </Box>
          )}
        </Card.Content>
      </Card>
    </PageLayoutV1>
  );
};

export default ProfilerConfigurationPage;
