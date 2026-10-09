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

import { Box, Grid, Typography } from '@openmetadata/ui-core-components';
import {
  Button,
  Form,
  FormProps,
  Input,
  InputNumber,
  Select,
  Slider,
} from 'antd';
import { useForm, useWatch } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { isUndefined, kebabCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DatePicker from '../../components/common/DatePicker/DatePicker';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ADD_KPI_BREADCRUMB } from '../../constants/Breadcrumb.constants';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { KPI_DATE_PICKER_FORMAT } from '../../constants/DataInsight.constants';
import { TabSpecificField } from '../../enums/entity.enum';
import {
  CreateKpiRequest,
  KpiTargetType,
} from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { withPageLayout } from '../../hoc/withPageLayout';
import { FieldProp, FieldTypes } from '../../interface/FormUtils.interface';
import { getListKPIs, postKPI } from '../../rest/KpiAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getDisabledDates } from '../../utils/DataInsightPureUtils';
import { getField } from '../../utils/formUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import {
  filterChartOptions,
  getDataInsightChartForKPI,
  KPIMetricTypeOptions,
} from '../../utils/KPI/KPIUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './kpi-page.less';
import { KPIFormValues } from './KPIPage.interface';
const AddKPIPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = useForm<KPIFormValues>();

  const [isCreatingKPI, setIsCreatingKPI] = useState<boolean>(false);
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const metricType = useWatch<KpiTargetType>('metricType', form);

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

  const handleFormValuesChange: FormProps['onValuesChange'] = (
    changedValues,
    allValues
  ) => {
    if (changedValues.startDate) {
      const startDate = changedValues.startDate.startOf('day');
      form.setFieldsValue({ startDate });
      if (startDate > allValues.endDate) {
        form.setFieldsValue({
          endDate: undefined,
        });
      }
    }

    if (changedValues.endDate) {
      let endDate = changedValues.endDate.endOf('day');
      form.setFieldsValue({ endDate });
      if (endDate < allValues.startDate) {
        endDate = changedValues.endDate.startOf('day');
        form.setFieldsValue({
          startDate: endDate,
        });
      }
    }
  };

  const handleSubmit: FormProps['onFinish'] = async (values) => {
    const startDate = values.startDate.valueOf();
    const endDate = values.endDate.valueOf();

    const dataInsightChart = getDataInsightChartForKPI(
      values.chartType,
      metricType
    );

    const formData: CreateKpiRequest = {
      dataInsightChart: dataInsightChart,
      description: values.description,
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

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: true,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      rules: [
        {
          required: true,
          message: t('label.field-required', {
            field: t('label.description-kpi'),
          }),
        },
      ],
      props: {
        'data-testid': 'description',
        initialValue: '',
        style: {
          margin: 0,
        },
        placeHolder: t('message.write-your-description'),
      },
    }),
    []
  );

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
            <Form
              data-testid="kpi-form"
              form={form}
              id="kpi-form"
              layout="vertical"
              validateMessages={VALIDATION_MESSAGES}
              onFinish={handleSubmit}
              onValuesChange={handleFormValuesChange}>
              <Form.Item
                label={t('label.select-a-chart')}
                name="chartType"
                rules={[
                  {
                    required: true,
                    message: t('message.field-text-is-required', {
                      fieldText: t('label.data-insight-chart'),
                    }),
                  },
                ]}>
                <Select
                  data-testid="chartType"
                  notFoundContent={t('message.all-charts-are-mapped')}
                  options={chartOptions}
                  placeholder={t('label.select-a-chart')}
                />
              </Form.Item>

              <Form.Item label={t('label.display-name')} name="displayName">
                <Input
                  data-testid="displayName"
                  placeholder={t('label.kpi-display-name')}
                  type="text"
                />
              </Form.Item>

              <Form.Item
                initialValue={KpiTargetType.Percentage}
                label={t('label.metric-type')}
                name="metricType">
                <Select
                  data-testid="metricType"
                  options={KPIMetricTypeOptions}
                />
              </Form.Item>

              {!isUndefined(metricType) && (
                <Form.Item
                  initialValue={0}
                  label={t('label.metric-value')}
                  name="targetValue"
                  rules={[
                    {
                      required: true,
                      validator: (_, value) => {
                        if (value >= 0) {
                          return Promise.resolve();
                        }

                        return Promise.reject(
                          t('message.field-text-is-required', {
                            fieldText: t('label.metric-value'),
                          })
                        );
                      },
                    },
                  ]}>
                  <>
                    {metricType === KpiTargetType.Percentage && (
                      <>
                        <Grid
                          className="layout-row layout-grid"
                          style={getLayoutGutter(32)}>
                          <Grid.Item className="layout-column" span={20}>
                            <Form.Item
                              noStyle
                              name="targetValue"
                              wrapperCol={{ span: 20 }}>
                              <Slider
                                className="kpi-slider"
                                marks={{
                                  0: '0%',
                                  100: '100%',
                                }}
                                max={100}
                                min={0}
                                tooltip={{
                                  open: false,
                                }}
                              />
                            </Form.Item>
                          </Grid.Item>
                          <Grid.Item className="layout-column" span={4}>
                            <Form.Item
                              noStyle
                              name="targetValue"
                              wrapperCol={{ span: 4 }}>
                              <InputNumber
                                formatter={(value) => `${value}%`}
                                max={100}
                                min={0}
                                step={1}
                              />
                            </Form.Item>
                          </Grid.Item>
                        </Grid>
                      </>
                    )}
                    {metricType === KpiTargetType.Number && (
                      <Form.Item noStyle name="targetValue">
                        <InputNumber
                          className="w-full"
                          data-testid="metric-number-input"
                          min={0}
                        />
                      </Form.Item>
                    )}
                  </>
                </Form.Item>
              )}

              <Grid
                className="layout-row layout-grid"
                style={getLayoutGutter(8, 8)}>
                <Grid.Item className="layout-column" span={12}>
                  <Form.Item
                    label={t('label.start-entity', {
                      entity: t('label.date'),
                    })}
                    messageVariables={{ fieldName: 'startDate' }}
                    name="startDate"
                    rules={[
                      {
                        required: true,
                        message: t('label.field-required', {
                          field: t('label.start-entity', {
                            entity: t('label.date'),
                          }),
                        }),
                      },
                    ]}>
                    <DatePicker
                      className="w-full"
                      data-testid="start-date"
                      disabledDate={getDisabledDates}
                      format={KPI_DATE_PICKER_FORMAT}
                    />
                  </Form.Item>
                </Grid.Item>
                <Grid.Item className="layout-column" span={12}>
                  <Form.Item
                    label={t('label.end-date')}
                    messageVariables={{ fieldName: 'endDate' }}
                    name="endDate"
                    rules={[
                      {
                        required: true,
                        message: t('label.field-required', {
                          field: t('label.end-date'),
                        }),
                      },
                    ]}>
                    <DatePicker
                      className="w-full"
                      data-testid="end-date"
                      disabledDate={getDisabledDates}
                      format={KPI_DATE_PICKER_FORMAT}
                    />
                  </Form.Item>
                </Grid.Item>
              </Grid>

              {getField(descriptionField)}

              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal w-full justify-end"
                gap={2}
                itemClassName="layout-space-item">
                <Button
                  data-testid="cancel-btn"
                  type="link"
                  onClick={handleCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  data-testid="submit-btn"
                  form="kpi-form"
                  htmlType="submit"
                  loading={isCreatingKPI}
                  type="primary">
                  {t('label.create')}
                </Button>
              </Box>
            </Form>
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
