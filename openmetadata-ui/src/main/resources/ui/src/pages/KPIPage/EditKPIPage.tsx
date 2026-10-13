/*
 *  Copyright 2022 Collate.
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
  Box,
  Button,
  FormField,
  FormItemLabel,
  Grid,
  HintText,
  HookForm,
  NumberInput,
  Slider,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Input, Select } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import MyDatePicker from '../../components/common/DatePicker/DatePicker';
import { EntityAttachmentProvider } from '../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ROUTES } from '../../constants/constants';
import { KPI_DATE_PICKER_FORMAT } from '../../constants/DataInsight.constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { DataInsightChart } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useAuth } from '../../hooks/authHooks';
import { useFqn } from '../../hooks/useFqn';
import { getKPIByName, patchKPI } from '../../rest/KpiAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import {
  getDataInsightPathWithFqn,
  getDisabledDates,
} from '../../utils/DataInsightPureUtils';
import {
  getKPIChartType,
  KPIChartOptions,
  KPIMetricTypeOptions,
} from '../../utils/KPI/KPIUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { KPIFormValues } from './KPIPage.interface';
import { normalizeKpiDates } from './KPIPage.utils';
const EditKPIPage = () => {
  const { isAdminUser } = useAuth();
  const { fqn: kpiName } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useForm<KPIFormValues>({
    mode: 'onChange',
    defaultValues: {
      metricType: KpiTargetType.Percentage,
      targetValue: 0,
      description: '',
    },
  });

  const [kpiData, setKpiData] = useState<Kpi>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdatingKPI, setIsUpdatingKPI] = useState<boolean>(false);
  const metricType = useWatch({ control: form.control, name: 'metricType' });

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.data-insight'),
        url: getDataInsightPathWithFqn(),
      },
      {
        name: t('label.kpi-list'),
        url: ROUTES.KPI_LIST,
      },
      {
        name: kpiData?.name ?? '',
        url: '',
        activeTitle: true,
      },
    ],
    [kpiData]
  );

  const initialValues = useMemo(() => {
    if (kpiData) {
      const startDate = DateTime.fromMillis(kpiData.startDate);
      const endDate = DateTime.fromMillis(kpiData.endDate);

      const chartType = getKPIChartType(
        kpiData.fullyQualifiedName as DataInsightChart
      );

      return {
        ...kpiData,
        startDate,
        endDate,
        chartType,
      };
    }

    return {};
  }, [kpiData]);

  const fetchKPI = async () => {
    setIsLoading(true);
    try {
      const response = await getKPIByName(kpiName, {
        fields: [
          TabSpecificField.START_DATE,
          TabSpecificField.END_DATE,
          TabSpecificField.TARGET_VALUE,
          TabSpecificField.DATA_INSIGHT_CHART,
          TabSpecificField.METRIC_TYPE,
        ],
      });
      setKpiData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => navigate(-1);

  const handleFormValuesChange = (
    changes: Partial<KPIFormValues>,
    values: KPIFormValues
  ) => {
    const dates = normalizeKpiDates(changes, values);
    if ('startDate' in dates) {
      form.setValue('startDate', dates.startDate ?? null, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if ('endDate' in dates) {
      form.setValue('endDate', dates.endDate ?? null, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const handleSubmit = async (values: KPIFormValues) => {
    if (values.targetValue == null || !values.startDate || !values.endDate) {
      return;
    }
    if (kpiData) {
      const { targetValue, description, displayName } = values;
      const startDate = values.startDate.valueOf();
      const endDate = values.endDate.valueOf();

      const updatedData = {
        ...kpiData,
        description,
        targetValue,
        displayName,
        endDate,
        startDate,
      };

      const patch = compare(kpiData, updatedData);

      setIsUpdatingKPI(true);
      try {
        await patchKPI(kpiData.id ?? '', patch);
        navigate(ROUTES.KPI_LIST);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsUpdatingKPI(false);
      }
    }
  };

  useEffect(() => {
    if (kpiData) {
      form.reset(initialValues);
    }
  }, [kpiData, initialValues, form.reset]);

  useEffect(() => {
    fetchKPI();
  }, [kpiName]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="edit-kpi-container">
            <TitleBreadcrumb className="m-t-0 my-4" titleLinks={breadcrumb} />
            <Typography as="p" className="text-base" data-testid="form-title">
              {t('label.edit-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography>
            <HookForm
              className="tw:flex tw:flex-col tw:gap-4"
              data-testid="kpi-form"
              form={form}
              id="kpi-form"
              onSubmit={form.handleSubmit(handleSubmit)}>
              <FormField
                control={form.control}
                name="chartType"
                rules={{
                  required: t('message.field-text-is-required', {
                    fieldText: t('label.data-insight-chart'),
                  }),
                }}>
                {({ field, fieldState }) => (
                  <Box direction="col" gap={2}>
                    <FormItemLabel required label={t('label.select-a-chart')} />
                    <Select
                      {...field}
                      disabled
                      aria-label={t('label.select-a-chart')}
                      data-testid="chartType"
                      notFoundContent={t('message.all-charts-are-mapped')}
                      options={KPIChartOptions}
                      placeholder={t('label.select-a-chart')}
                    />
                    {fieldState.error && (
                      <HintText isInvalid>{fieldState.error.message}</HintText>
                    )}
                  </Box>
                )}
              </FormField>
              <FormField control={form.control} name="displayName">
                {({ field, fieldState }) => (
                  <Box direction="col" gap={2}>
                    <FormItemLabel
                      label={t('label.display-name')}
                      required={false}
                    />
                    <Input
                      {...field}
                      aria-label={t('label.display-name')}
                      data-testid="displayName"
                      placeholder={t('label.kpi-display-name')}
                      type="text"
                    />
                    {fieldState.error && (
                      <HintText isInvalid>{fieldState.error.message}</HintText>
                    )}
                  </Box>
                )}
              </FormField>
              <FormField control={form.control} name="metricType">
                {({ field, fieldState }) => (
                  <Box direction="col" gap={2}>
                    <FormItemLabel
                      label={t('label.metric-type')}
                      required={false}
                    />
                    <Select
                      {...field}
                      disabled
                      aria-label={t('label.metric-type')}
                      data-testid="metricType"
                      options={KPIMetricTypeOptions}
                    />
                    {fieldState.error && (
                      <HintText isInvalid>{fieldState.error.message}</HintText>
                    )}
                  </Box>
                )}
              </FormField>
              {!isUndefined(metricType) && (
                <FormField
                  control={form.control}
                  name="targetValue"
                  rules={{
                    validate: (value) =>
                      (value != null && Number.isFinite(value) && value >= 0) ||
                      t('message.field-text-is-required', {
                        fieldText: t('label.metric-value'),
                      }),
                  }}>
                  {({ field, fieldState }) => (
                    <Box direction="col" gap={2}>
                      <FormItemLabel required label={t('label.metric-value')} />
                      <Box align="center" gap={4}>
                        {metricType === KpiTargetType.Percentage && (
                          <Slider
                            showRange
                            aria-label={t('label.metric-value')}
                            className="tw:flex-1"
                            labelFormatter={(value) => value + '%'}
                            maxValue={100}
                            minValue={0}
                            value={field.value ?? 0}
                            onChange={(value) =>
                              field.onChange(
                                Array.isArray(value) ? value[0] : value
                              )
                            }
                          />
                        )}
                        <NumberInput
                          aria-label={t('label.metric-value')}
                          className="tw:w-24 tw:shrink-0"
                          inputDataTestId="metric-number-input"
                          isInvalid={!!fieldState.error}
                          maxValue={
                            metricType === KpiTargetType.Percentage
                              ? 100
                              : undefined
                          }
                          minValue={0}
                          suffix={
                            metricType === KpiTargetType.Percentage
                              ? '%'
                              : undefined
                          }
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                        />
                      </Box>
                      {fieldState.error && (
                        <HintText isInvalid>
                          {fieldState.error.message}
                        </HintText>
                      )}
                    </Box>
                  )}
                </FormField>
              )}
              <Grid
                className="layout-row layout-grid"
                style={getLayoutGutter(8, 8)}>
                <Grid.Item className="layout-column" span={12}>
                  <FormField
                    control={form.control}
                    name="startDate"
                    rules={{
                      required: t('label.field-required', {
                        field: t('label.start-entity', {
                          entity: t('label.date'),
                        }),
                      }),
                    }}>
                    {({ field, fieldState }) => (
                      <Box direction="col" gap={2}>
                        <FormItemLabel
                          required
                          label={t('label.start-entity', {
                            entity: t('label.date'),
                          })}
                        />
                        <MyDatePicker
                          aria-label={t('label.start-entity', {
                            entity: t('label.date'),
                          })}
                          className="w-full"
                          data-testid="start-date"
                          disabledDate={getDisabledDates}
                          format={KPI_DATE_PICKER_FORMAT}
                          value={field.value ?? null}
                          onBlur={field.onBlur}
                          onChange={(value) => {
                            field.onChange(value);
                            handleFormValuesChange(
                              { startDate: value ?? undefined },
                              form.getValues()
                            );
                          }}
                        />
                        {fieldState.error && (
                          <HintText isInvalid>
                            {fieldState.error.message}
                          </HintText>
                        )}
                      </Box>
                    )}
                  </FormField>
                </Grid.Item>
                <Grid.Item className="layout-column" span={12}>
                  <FormField
                    control={form.control}
                    name="endDate"
                    rules={{
                      required: t('label.field-required', {
                        field: t('label.end-date'),
                      }),
                    }}>
                    {({ field, fieldState }) => (
                      <Box direction="col" gap={2}>
                        <FormItemLabel required label={t('label.end-date')} />
                        <MyDatePicker
                          aria-label={t('label.end-date')}
                          className="w-full"
                          data-testid="end-date"
                          disabledDate={getDisabledDates}
                          format={KPI_DATE_PICKER_FORMAT}
                          value={field.value ?? null}
                          onBlur={field.onBlur}
                          onChange={(value) => {
                            field.onChange(value);
                            handleFormValuesChange(
                              { endDate: value ?? undefined },
                              form.getValues()
                            );
                          }}
                        />
                        {fieldState.error && (
                          <HintText isInvalid>
                            {fieldState.error.message}
                          </HintText>
                        )}
                      </Box>
                    )}
                  </FormField>
                </Grid.Item>
              </Grid>
              <EntityAttachmentProvider
                entityFqn={kpiData?.fullyQualifiedName}
                entityType={EntityType.KPI}>
                <FormField control={form.control} name="description">
                  {({ field, fieldState }) => (
                    <Box direction="col" gap={2}>
                      <FormItemLabel
                        label={t('label.description')}
                        required={false}
                      />
                      <RichTextEditor
                        data-testid="description"
                        initialValue={kpiData?.description}
                        placeHolder={t('message.write-your-description')}
                        onTextChange={field.onChange}
                      />
                      {fieldState.error && (
                        <HintText isInvalid>
                          {fieldState.error.message}
                        </HintText>
                      )}
                    </Box>
                  )}
                </FormField>
              </EntityAttachmentProvider>
              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal w-full justify-end"
                gap={2}
                itemClassName="layout-space-item">
                <Button
                  color="link-color"
                  data-testid="cancel-btn"
                  onClick={handleCancel}>
                  {t('label.go-back')}
                </Button>
                {isAdminUser ? (
                  <Tooltip arrow title={t('label.save')}>
                    <Button
                      color="primary"
                      data-testid="submit-btn"
                      isLoading={isUpdatingKPI}
                      size="sm"
                      type="submit">
                      {t('label.save')}
                    </Button>
                  </Tooltip>
                ) : null}
              </Box>
            </HookForm>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.edit-entity', {
        entity: t('label.kpi-uppercase'),
      })}
      secondPanel={{
        children: (
          <div data-testid="right-panel">
            <Typography as="p" className="text-base font-medium">
              {t('label.edit-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography>
            <Typography>{t('message.add-kpi-message')}</Typography>
          </div>
        ),
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(EditKPIPage);
