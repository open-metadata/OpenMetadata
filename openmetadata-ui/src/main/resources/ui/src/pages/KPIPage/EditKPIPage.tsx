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

import { Button, Col, Form, FormProps, Input, InputNumber, Row, Slider, Space, Typography,  } from 'antd';
import { Select, Tooltip } from '../../components/common/AntdCompat';;
import { useForm, useWatch } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import MyDatePicker from '../../components/common/DatePicker/DatePicker';
import { EntityAttachmentProvider } from '../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { KPI_DATE_PICKER_FORMAT } from '../../constants/DataInsight.constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { DataInsightChart } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useAuth } from '../../hooks/authHooks';
import { useFqn } from '../../hooks/useFqn';
import { FieldProp, FieldTypes } from '../../interface/FormUtils.interface';
import { getKPIByName, patchKPI } from '../../rest/KpiAPI';
import {
  getDataInsightPathWithFqn,
  getDisabledDates,
} from '../../utils/DataInsightUtils';
import { getField } from '../../utils/formUtils';
import {
  getKPIChartType,
  KPIChartOptions,
  KPIMetricTypeOptions,
} from '../../utils/KPI/KPIUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './kpi-page.less';
import { KPIFormValues } from './KPIPage.interface';

const EditKPIPage = () => {
  const { isAdminUser } = useAuth();
  const { fqn: kpiName } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = useForm<KPIFormValues>();

  const [kpiData, setKpiData] = useState<Kpi>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdatingKPI, setIsUpdatingKPI] = useState<boolean>(false);
  const metricType = useWatch<KpiTargetType>('metricType', form);

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

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: false,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: kpiData?.description,
        style: {
          margin: 0,
        },
        placeHolder: t('message.write-your-description'),
      },
    }),
    [kpiData?.description]
  );

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
            <Typography.Paragraph
              className="text-base"
              data-testid="form-title">
              {t('label.edit-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography.Paragraph>
            <Form
              data-testid="kpi-form"
              form={form}
              id="kpi-form"
              initialValues={initialValues}
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
                  disabled
                  data-testid="chartType"
                  notFoundContent={t('message.all-charts-are-mapped')}
                  options={KPIChartOptions}
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
                  disabled
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
                        <Row gutter={32}>
                          <Col span={20}>
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
                          </Col>
                          <Col span={4}>
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
                          </Col>
                        </Row>
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
                    <MyDatePicker
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
                    <MyDatePicker
                      className="w-full"
                      data-testid="end-date"
                      disabledDate={getDisabledDates}
                      format={KPI_DATE_PICKER_FORMAT}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <EntityAttachmentProvider
                entityFqn={kpiData?.fullyQualifiedName}
                entityType={EntityType.KPI}>
                {getField(descriptionField)}
              </EntityAttachmentProvider>
              <Space align="center" className="w-full justify-end">
                <Button
                  data-testid="cancel-btn"
                  type="link"
                  onClick={handleCancel}>
                  {t('label.go-back')}
                </Button>
                {isAdminUser ? (
                  <Tooltip title={t('label.save')}>
                    <Button
                      data-testid="submit-btn"
                      htmlType="submit"
                      loading={isUpdatingKPI}
                      type="primary">
                      {t('label.save')}
                    </Button>
                  </Tooltip>
                ) : null}
              </Space>
            </Form>
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
            <Typography.Paragraph className="text-base font-medium">
              {t('label.edit-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography.Paragraph>
            <Typography.Text>{t('message.add-kpi-message')}</Typography.Text>
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
