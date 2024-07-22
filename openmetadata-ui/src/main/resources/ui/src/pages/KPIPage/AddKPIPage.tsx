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
  Button,
  Col,
  DatePicker,
  Form,
  FormProps,
  Input,
  InputNumber,
  Row,
  Select,
  Slider,
  Space,
  Typography,
} from 'antd';
import { useForm, useWatch } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isUndefined, kebabCase, map, startCase } from 'lodash';
import moment from 'moment';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { KPI_DATE_PICKER_FORMAT } from '../../constants/DataInsight.constants';
import {
  CreateKpiRequest,
  DataInsightChart,
  KpiTargetType,
} from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { getListKPIs, postKPI } from '../../rest/KpiAPI';
import {
  getDataInsightPathWithFqn,
  getDisabledDates,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './kpi-page.less';
import { KPIFormValues } from './KPIPage.interface';

const breadcrumb = [
  {
    name: t('label.data-insight'),
    url: getDataInsightPathWithFqn(),
  },
  {
    name: t('label.kpi-list'),
    url: ROUTES.KPI_LIST,
  },
  {
    name: t('label.add-new-entity', { entity: t('label.kpi-uppercase') }),
    url: '',
    activeTitle: true,
  },
];

const AddKPIPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [form] = useForm<KPIFormValues>();

  const [description, setDescription] = useState<string>('');
  const [metricValue, setMetricValue] = useState<number>(0);
  const [isCreatingKPI, setIsCreatingKPI] = useState<boolean>(false);
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);

  const chartType = useWatch<DataInsightChart>('dataInsightChart', form);
  const chartOptions = useMemo(() => {
    const initOptions = map(DataInsightChart, (value) => ({
      label: startCase(value),
      value,
    }));
    const addedCharts = kpiList.map(
      (kpi) => kpi.dataInsightChart.fullyQualifiedName
    );

    return initOptions.filter((option) => !addedCharts.includes(option.value));
  }, [kpiList]);

  const fetchKpiList = async () => {
    try {
      const response = await getListKPIs({
        fields: 'dataInsightChart',
      });

      setKpiList(response.data);
    } catch (err) {
      setKpiList([]);
    }
  };

  const handleCancel = () => history.goBack();

  const handleFormValuesChange = (
    changedValues: Partial<KPIFormValues>,
    allValues: KPIFormValues
  ) => {
    if (changedValues.startDate) {
      const startDate = moment(changedValues.startDate).startOf('day');
      form.setFieldsValue({ startDate });
      if (changedValues.startDate > allValues.endDate) {
        form.setFieldsValue({
          endDate: '',
        });
      }
    }

    if (changedValues.endDate) {
      let endDate = moment(changedValues.endDate).endOf('day');
      form.setFieldsValue({ endDate });
      if (changedValues.endDate < allValues.startDate) {
        endDate = moment(changedValues.endDate).startOf('day');
        form.setFieldsValue({
          startDate: endDate,
        });
      }
    }
  };

  const metricType = useMemo(() => {
    return [
      DataInsightChart.PercentageOfDataAssetWithDescriptionKpi,
      DataInsightChart.PercentageOfDataAssetWithOwnerKpi,
    ].includes(chartType)
      ? KpiTargetType.Percentage
      : KpiTargetType.Number;
  }, [chartType]);

  const handleSubmit: FormProps['onFinish'] = async (values) => {
    const startDate = values.startDate.valueOf();
    const endDate = values.endDate.valueOf();

    const targetValue = metricValue;

    const formData: CreateKpiRequest = {
      dataInsightChart: values.dataInsightChart,
      description,
      name: kebabCase(`${values.displayName ?? ''} ${metricType}`),
      displayName: values.displayName,
      startDate,
      endDate,
      metricType,
      targetValue,
    };
    setIsCreatingKPI(true);
    try {
      await postKPI(formData);
      history.push(ROUTES.KPI_LIST);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreatingKPI(false);
    }
  };

  useEffect(() => {
    fetchKpiList();
  }, []);

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        children: (
          <div
            className="max-width-md w-9/10 service-form-container"
            data-testid="add-kpi-container">
            <TitleBreadcrumb className="my-4" titleLinks={breadcrumb} />
            <Typography.Paragraph
              className="text-base"
              data-testid="form-title">
              {t('label.add-new-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography.Paragraph>
            <Form
              data-testid="kpi-form"
              form={form}
              id="kpi-form"
              layout="vertical"
              validateMessages={VALIDATION_MESSAGES}
              onFinish={handleSubmit}
              onValuesChange={handleFormValuesChange}>
              <Form.Item
                initialValue={
                  DataInsightChart.PercentageOfDataAssetWithDescriptionKpi
                }
                label={t('label.select-a-chart')}
                name="dataInsightChart"
                rules={[
                  {
                    required: true,
                    message: t('message.field-text-is-required', {
                      fieldText: t('label.data-insight-chart'),
                    }),
                  },
                ]}>
                <Select
                  data-testid="dataInsightChart"
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

              {!isUndefined(metricType) && (
                <Form.Item
                  label={t('label.metric-value')}
                  name="metricValue"
                  rules={[
                    {
                      required: true,
                      validator: () => {
                        if (metricValue >= 0) {
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
                      <Row data-testid="metric-percentage-input" gutter={20}>
                        <Col span={20}>
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
                            value={metricValue}
                            onChange={(value) => {
                              setMetricValue(value);
                            }}
                          />
                        </Col>
                        <Col span={4}>
                          <InputNumber
                            formatter={(value) => `${value}%`}
                            max={100}
                            min={0}
                            step={1}
                            value={metricValue}
                            onChange={(value) => {
                              setMetricValue(Number(value));
                            }}
                          />
                        </Col>
                      </Row>
                    )}
                    {metricType === KpiTargetType.Number && (
                      <InputNumber
                        className="w-full"
                        data-testid="metric-number-input"
                        min={0}
                        value={metricValue}
                        onChange={(value) => setMetricValue(Number(value))}
                      />
                    )}
                  </>
                </Form.Item>
              )}

              <Row gutter={[8, 8]}>
                <Col span={12}>
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
                </Col>
                <Col span={12}>
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
                </Col>
              </Row>

              <Form.Item label={t('label.description')} name="description">
                <RichTextEditor
                  height="200px"
                  initialValue={description}
                  placeHolder={t('message.write-your-description')}
                  style={{ margin: 0 }}
                  onTextChange={(value) => setDescription(value)}
                />
              </Form.Item>

              <Space align="center" className="w-full justify-end">
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
                  {t('label.submit')}
                </Button>
              </Space>
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
            <Typography.Paragraph className="text-base font-medium">
              {t('label.add-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography.Paragraph>
            <Typography.Text>{t('message.add-kpi-message')}</Typography.Text>
          </div>
        ),
        className: 'p-md p-t-xl content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default AddKPIPage;
