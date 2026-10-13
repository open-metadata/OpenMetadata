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
  Typography,
} from '@openmetadata/ui-core-components';
import { Input, Select } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined, kebabCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DatePicker from '../../components/common/DatePicker/DatePicker';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ADD_KPI_BREADCRUMB } from '../../constants/Breadcrumb.constants';
import { ROUTES } from '../../constants/constants';
import { KPI_DATE_PICKER_FORMAT } from '../../constants/DataInsight.constants';
import { TabSpecificField } from '../../enums/entity.enum';
import {
  CreateKpiRequest,
  KpiTargetType,
} from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { withPageLayout } from '../../hoc/withPageLayout';
import { getListKPIs, postKPI } from '../../rest/KpiAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getDisabledDates } from '../../utils/DataInsightPureUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import {
  filterChartOptions,
  getDataInsightChartForKPI,
  KPIMetricTypeOptions,
} from '../../utils/KPI/KPIUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { KPIFormValues } from './KPIPage.interface';
import { normalizeKpiDates } from './KPIPage.utils';
const AddKPIPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const form = useForm<KPIFormValues>({
    mode: 'onChange',
    defaultValues: {
      metricType: KpiTargetType.Percentage,
      targetValue: 0,
      description: '',
    },
  });

  const [isCreatingKPI, setIsCreatingKPI] = useState<boolean>(false);
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const metricType = useWatch({ control: form.control, name: 'metricType' });

  const chartOptions = useMemo(() => {
    return filterChartOptions(kpiList);
  }, [kpiList]);

  const fetchKpiList = async () => {
    try {
      const response = await getListKPIs({
        fields: TabSpecificField.DATA_INSIGHT_CHART,
      });

      setKpiList(response.data);
    } catch {
      setKpiList([]);
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
    const startDate = values.startDate.valueOf();
    const endDate = values.endDate.valueOf();

    const dataInsightChart = getDataInsightChartForKPI(
      values.chartType,
      metricType
    );

    const formData: CreateKpiRequest = {
      dataInsightChart: dataInsightChart,
      description: values.description ?? '',
      name: kebabCase(`${values.displayName ?? ''} ${metricType}`),
      displayName: values.displayName,
      startDate,
      endDate,
      metricType,
      targetValue: values.targetValue,
    };

    setIsCreatingKPI(true);
    try {
      await postKPI(formData);
      navigate(ROUTES.KPI_LIST);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreatingKPI(false);
    }
  };

  useEffect(() => {
    fetchKpiList();
  }, []);

  const translatedKPIBreadcrumb = useMemo(
    () =>
      ADD_KPI_BREADCRUMB.map((option) => ({
        ...option,
        name: translateWithNestedKeys(option.name, option.nameData),
      })),
    [t]
  );

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="add-kpi-container">
            <TitleBreadcrumb
              className="m-t-0 my-4"
              titleLinks={translatedKPIBreadcrumb}
            />
            <Typography
              as="p"
              className="text-base tw:mb-4!"
              data-testid="form-title">
              {t('label.add-new-entity', {
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
                      aria-label={t('label.select-a-chart')}
                      data-testid="chartType"
                      notFoundContent={t('message.all-charts-are-mapped')}
                      options={chartOptions}
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
                        <DatePicker
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
                        <DatePicker
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
              <FormField
                control={form.control}
                name="description"
                rules={{
                  required: t('label.field-required', {
                    field: t('label.description-kpi'),
                  }),
                }}>
                {({ field, fieldState }) => (
                  <Box direction="col" gap={2}>
                    <FormItemLabel required label={t('label.description')} />
                    <RichTextEditor
                      data-testid="description"
                      initialValue=""
                      placeHolder={t('message.write-your-description')}
                      onTextChange={field.onChange}
                    />
                    {fieldState.error && (
                      <HintText isInvalid>{fieldState.error.message}</HintText>
                    )}
                  </Box>
                )}
              </FormField>
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
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="submit-btn"
                  form="kpi-form"
                  isLoading={isCreatingKPI}
                  type="submit">
                  {t('label.create')}
                </Button>
              </Box>
            </HookForm>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-new-entity', {
        entity: t('label.kpi-uppercase'),
      })}
      secondPanel={{
        children: (
          <div data-testid="right-panel">
            <Typography as="p" className="text-base font-medium tw:mb-4!">
              {t('label.add-entity', {
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

export default withPageLayout(AddKPIPage);
