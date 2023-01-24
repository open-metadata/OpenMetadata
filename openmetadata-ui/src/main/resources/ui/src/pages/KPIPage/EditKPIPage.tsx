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
  Card,
  Col,
  DatePicker,
  Form,
  FormProps,
  Input,
  InputNumber,
  Row,
  Slider,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from 'components/Loader/Loader';
import { compare } from 'fast-json-patch';
import { isUndefined, toInteger, toNumber } from 'lodash';
import moment from 'moment';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getChartById } from 'rest/DataInsightAPI';
import { getKPIByName, patchKPI } from 'rest/KpiAPI';
import { ROUTES } from '../../constants/constants';
import {
  KPI_DATE_PICKER_FORMAT,
  VALIDATE_MESSAGES,
} from '../../constants/DataInsight.constants';
import { DataInsightChart } from '../../generated/dataInsight/dataInsightChart';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { useAuth } from '../../hooks/authHooks';
import {
  getDisabledDates,
  getKpiTargetValueByMetricType,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { KPIFormValues } from './KPIPage.interface';
import './KPIPage.less';

const EditKPIPage = () => {
  const { isAdminUser } = useAuth();
  const { kpiName } = useParams<{ kpiName: string }>();

  const { t } = useTranslation();
  const history = useHistory();
  const [form] = useForm<KPIFormValues>();

  const [kpiData, setKpiData] = useState<Kpi>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [description, setDescription] = useState<string>('');

  const [selectedChart, setSelectedChart] = useState<DataInsightChart>();

  const [metricValue, setMetricValue] = useState<number>(0);
  const [isUpdatingKPI, setIsUpdatingKPI] = useState<boolean>(false);

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.data-insight'),
        url: ROUTES.DATA_INSIGHT,
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

  const metricData = useMemo(() => {
    if (kpiData) {
      return kpiData.targetDefinition[0];
    }

    return;
  }, [kpiData]);

  const initialValues = useMemo(() => {
    if (kpiData) {
      const metric = kpiData.targetDefinition[0];
      const chart = kpiData.dataInsightChart;
      const startDate = moment(kpiData.startDate);
      const endDate = moment(kpiData.endDate);

      return {
        name: kpiData.name,
        displayName: kpiData.displayName,
        dataInsightChart: chart.displayName || chart.name,
        metricType: metric.name,
        startDate,
        endDate,
      };
    }

    return {};
  }, [kpiData]);

  const fetchKPI = async () => {
    setIsLoading(true);
    try {
      const response = await getKPIByName(kpiName, {
        fields:
          'startDate,endDate,targetDefinition,dataInsightChart,metricType',
      });
      setKpiData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChartData = async () => {
    const chartId = kpiData?.dataInsightChart.id;
    if (chartId) {
      try {
        const response = await getChartById(chartId);
        setSelectedChart(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
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

  const handleSubmit: FormProps['onFinish'] = async (values) => {
    if (kpiData && metricData) {
      const startDate = values.startDate.valueOf();
      const endDate = values.endDate.valueOf();

      const targetValue = getKpiTargetValueByMetricType(
        kpiData.metricType,
        metricValue
      );

      const updatedData = {
        ...kpiData,
        description,
        displayName: values.displayName,
        endDate,
        startDate,
        targetDefinition: [
          {
            ...metricData,
            value: targetValue + '',
          },
        ],
      };

      const patch = compare(kpiData, updatedData);

      setIsUpdatingKPI(true);
      try {
        await patchKPI(kpiData.id ?? '', patch);
        history.push(ROUTES.KPI_LIST);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsUpdatingKPI(false);
      }
    }
  };

  useEffect(() => {
    fetchKPI();
  }, [kpiName]);

  useEffect(() => {
    if (kpiData) {
      fetchChartData();
      setDescription(kpiData.description);
    }
  }, [kpiData]);

  useEffect(() => {
    const value = toNumber(metricData?.value ?? '0');
    const metricType = kpiData?.metricType;

    // for percentage metric convert the fraction to percentage
    const metricValue =
      metricType === KpiTargetType.Percentage ? value * 100 : value;

    setMetricValue(toInteger(metricValue));
  }, [metricData, kpiData]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      {kpiData ? (
        <Row
          className="bg-body-main h-full"
          data-testid="edit-kpi-container"
          gutter={[16, 16]}>
          <Col offset={4} span={12}>
            <TitleBreadcrumb className="my-4" titleLinks={breadcrumb} />
            <Card>
              <Typography.Paragraph
                className="text-base"
                data-testid="form-title">
                {t('label.edit-entity', { entity: t('label.kpi-uppercase') })}
              </Typography.Paragraph>
              <Form
                data-testid="kpi-form"
                form={form}
                id="kpi-form"
                initialValues={initialValues}
                layout="vertical"
                validateMessages={VALIDATE_MESSAGES}
                onFinish={handleSubmit}
                onValuesChange={handleFormValuesChange}>
                <Form.Item
                  label={t('label.data-insight-chart')}
                  name="dataInsightChart">
                  <Input
                    disabled
                    data-testid="dataInsightChart"
                    value={selectedChart?.displayName || selectedChart?.name}
                  />
                </Form.Item>

                <Form.Item label={t('label.display-name')} name="displayName">
                  <Input
                    data-testid="displayName"
                    placeholder={t('label.kpi-display-name')}
                    type="text"
                  />
                </Form.Item>

                <Form.Item label={t('label.metric-type')} name="metricType">
                  <Input
                    disabled
                    data-testid="metricType"
                    value={metricData?.name}
                  />
                </Form.Item>

                {!isUndefined(metricData) && (
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
                      {kpiData?.metricType === KpiTargetType.Percentage && (
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
                              tooltip={{ open: false }}
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
                      {kpiData?.metricType === KpiTargetType.Number && (
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
                    {t('label.go-back')}
                  </Button>
                  <Tooltip
                    title={
                      isAdminUser
                        ? t('label.save')
                        : t('message.no-permission-for-action')
                    }>
                    <Button
                      data-testid="submit-btn"
                      disabled={!isAdminUser}
                      form="kpi-form"
                      htmlType="submit"
                      loading={isUpdatingKPI}
                      type="primary">
                      {t('label.save')}
                    </Button>
                  </Tooltip>
                </Space>
              </Form>
            </Card>
          </Col>
          <Col className="m-t-md" data-testid="right-panel" span={4}>
            <Typography.Paragraph className="text-base font-medium">
              {t('label.edit-entity', { entity: t('label.kpi-uppercase') })}
            </Typography.Paragraph>
            <Typography.Text>{t('message.add-kpi-message')}</Typography.Text>
          </Col>
        </Row>
      ) : (
        <ErrorPlaceHolder>
          {t('message.no-kpi-found', { name: kpiName })}
        </ErrorPlaceHolder>
      )}
    </>
  );
};

export default EditKPIPage;
