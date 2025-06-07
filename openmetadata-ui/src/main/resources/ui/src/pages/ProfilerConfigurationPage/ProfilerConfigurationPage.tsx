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
import { CloseOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Row,
  Select,
  Switch,
  TreeSelect,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isEqual, values } from 'lodash';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
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
import { SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './profiler-configuration-page.style.less';

const ProfilerConfigurationPage = () => {
  const [form] = Form.useForm();
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
  const selectedMetricConfiguration = Form.useWatch<
    MetricConfigurationDefinition[]
  >('metricConfiguration', form);

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

  const handleSubmit = async (data: ProfilerConfiguration) => {
    setIsFormSubmitting(true);
    const metricConfiguration = data.metricConfiguration?.map((item) => {
      if (isEqual(item.metrics, ['all'])) {
        return {
          ...item,
          // If all metrics are selected, then we will send full array of metrics
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
        },
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

      form.setFieldsValue(
        isEmpty(data?.config_value?.metricConfiguration)
          ? DEFAULT_PROFILER_CONFIG_VALUE
          : data?.config_value
      );
    } catch (error) {
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
      <Row
        align="middle"
        className="profiler-configuration-page-container"
        gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <PageHeader
            data={{
              header: t('label.profiler-configuration'),
              subHeader: t(
                'message.page-sub-header-for-profiler-configuration'
              ),
            }}
          />
        </Col>
        <Col span={24}>
          <Card className="profiler-configuration-form-item-container">
            <Form<ProfilerConfiguration>
              data-testid="profiler-config-form"
              form={form}
              id="profiler-config"
              layout="vertical"
              onFinish={handleSubmit}>
              <Form.List name="metricConfiguration">
                {(fields, { add, remove }) => {
                  return (
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Typography.Text className="text-grey-muted">
                          {t('label.add-entity', {
                            entity: t('label.metric-configuration'),
                          })}
                        </Typography.Text>
                      </Col>
                      <Col span={10}>
                        {t('label.data-type')}
                        <span className="text-failure">*</span>
                      </Col>
                      <Col span={11}>{t('label.metric-type')}</Col>
                      <Col span={3}>{t('label.disable')}</Col>
                      {fields.map(({ key, name }) => (
                        <Fragment key={key}>
                          <Col span={10}>
                            <Form.Item
                              name={[name, 'dataType']}
                              rules={[
                                {
                                  required: true,
                                  message: t('message.field-text-is-required', {
                                    fieldText: t('label.data-type'),
                                  }),
                                },
                              ]}>
                              <Select
                                allowClear
                                data-testid="data-type-select"
                                options={dataTypeOptions}
                                placeholder={t('label.select-field', {
                                  field: t('label.data-type'),
                                })}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={11}>
                            <Form.Item
                              noStyle
                              shouldUpdate={(prevValues, currentValues) => {
                                return !isEqual(
                                  prevValues['metricConfiguration']?.[name]?.[
                                    'disabled'
                                  ],
                                  currentValues['metricConfiguration']?.[
                                    name
                                  ]?.['disabled']
                                );
                              }}>
                              {() => (
                                <Form.Item name={[name, 'metrics']}>
                                  <TreeSelect
                                    allowClear
                                    treeCheckable
                                    data-testid="metric-type-select"
                                    disabled={form.getFieldValue([
                                      'metricConfiguration',
                                      name,
                                      'disabled',
                                    ])}
                                    maxTagCount={5}
                                    placeholder={t('label.select-field', {
                                      field: t('label.metric-type'),
                                    })}
                                    showCheckedStrategy={TreeSelect.SHOW_PARENT}
                                    treeData={PROFILER_METRICS_TYPE_OPTIONS}
                                  />
                                </Form.Item>
                              )}
                            </Form.Item>
                          </Col>
                          <Col className="d-flex justify-between" span={3}>
                            <Form.Item
                              name={[name, 'disabled']}
                              valuePropName="checked">
                              <Switch data-testid="disabled-switch" />
                            </Form.Item>
                            <Form.Item>
                              <Button
                                data-testid={`remove-filter-${name}`}
                                icon={<CloseOutlined />}
                                size="small"
                                onClick={() => remove(name)}
                              />
                            </Form.Item>
                          </Col>
                        </Fragment>
                      ))}

                      <Col span={24}>
                        <Button
                          data-testid="add-fields"
                          type="primary"
                          onClick={() => add()}>
                          {t('label.add-entity', {
                            entity: t('label.field'),
                          })}
                        </Button>
                      </Col>
                    </Row>
                  );
                }}
              </Form.List>
            </Form>
          </Card>
        </Col>
        <Col className="d-flex justify-end gap-2" span={24}>
          <Button data-testid="cancel-button" onClick={() => navigate(-1)}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="save-button"
            form="profiler-config"
            htmlType="submit"
            loading={isFormSubmitting}
            type="primary">
            {t('label.save')}
          </Button>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default ProfilerConfigurationPage;
