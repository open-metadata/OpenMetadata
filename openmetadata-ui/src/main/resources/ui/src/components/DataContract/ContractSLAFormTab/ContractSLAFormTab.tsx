/*
 *  Copyright 2025 Collate.
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
  Form,
  InputNumber,
  Row,
  Select,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd';
import { FormProps } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import moment from 'moment';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import {
  MAX_LATENCY_UNITS,
  REFRESH_FREQUENCY_UNITS,
  RETENTION_UNITS,
  SLA_AVAILABILITY_TIME_FORMAT,
} from '../../../constants/DataContract.constants';
import {
  ContractSLA,
  DataContract,
  Timezone,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { filterSelectOptions } from '../../../utils/CommonUtils';
import { generateSelectOptionsFromString } from '../../../utils/DataContract/DataContractUtils';
import { getPopupContainer } from '../../../utils/formUtils';
import { getColumnOptionsFromTableColumn } from '../../../utils/TableUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import './contract-sla-form-tab.less';

export const ContractSLAFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({ onChange, onPrev, buttonProps, initialValues }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { data: tableData } = useGenericContext();

  const columnOptions = useMemo(() => {
    const { columns } = tableData as Table;
    if (isEmpty(columns)) {
      return [];
    }

    return getColumnOptionsFromTableColumn(columns, true);
  }, [tableData]);

  const {
    RETENTION_UNIT_OPTIONS,
    MAX_LATENCY_OPTIONS,
    REFRESH_FREQUENCY_UNIT_OPTIONS,
    TIMEZONE_OPTIONS,
  } = useMemo(() => {
    return {
      REFRESH_FREQUENCY_UNIT_OPTIONS: generateSelectOptionsFromString(
        REFRESH_FREQUENCY_UNITS
      ),
      RETENTION_UNIT_OPTIONS: generateSelectOptionsFromString(RETENTION_UNITS),
      MAX_LATENCY_OPTIONS: generateSelectOptionsFromString(MAX_LATENCY_UNITS),
      TIMEZONE_OPTIONS: Object.values(Timezone).map((tz) => ({
        label: tz,
        value: tz,
      })),
    };
  }, []);

  const handleFormChange: FormProps['onValuesChange'] = (_, values) => {
    const slaData: ContractSLA = {};

    if (values.availabilityTime) {
      slaData.availabilityTime = values.availabilityTime.format(
        SLA_AVAILABILITY_TIME_FORMAT
      );
    }

    if (values.timezone) {
      slaData.timezone = values.timezone;
    }

    if (values.columnName) {
      slaData.columnName = values.columnName;
    }

    if (values.max_latency_unit && values.max_latency_value >= 0) {
      slaData.maxLatency = {
        unit: values.max_latency_unit,
        value: values.max_latency_value,
      };
    }

    if (
      values.refresh_frequency_interval >= 0 &&
      values.refresh_frequency_unit
    ) {
      slaData.refreshFrequency = {
        interval: values.refresh_frequency_interval,
        unit: values.refresh_frequency_unit,
      };
    }

    if (values.retention_period >= 0 && values.retention_unit) {
      slaData.retention = {
        period: values.retention_period,
        unit: values.retention_unit,
      };
    }

    onChange({ sla: slaData });
  };

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        max_latency_unit: initialValues.sla?.maxLatency?.unit,
        max_latency_value: initialValues.sla?.maxLatency?.value,
        refresh_frequency_interval:
          initialValues.sla?.refreshFrequency?.interval,
        refresh_frequency_unit: initialValues.sla?.refreshFrequency?.unit,
        retention_period: initialValues.sla?.retention?.period,
        retention_unit: initialValues.sla?.retention?.unit,
        timezone: initialValues.sla?.timezone,
        columnName: initialValues.sla?.columnName,
        availabilityTime: initialValues.sla?.availabilityTime
          ? moment(
              initialValues.sla?.availabilityTime,
              SLA_AVAILABILITY_TIME_FORMAT
            )
          : undefined,
      });
    }
  }, [initialValues]);

  return (
    <>
      <Card className="sla-container container bg-grey p-box">
        <div>
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.sla')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.data-contract-sla-description')}
          </Typography.Paragraph>
        </div>

        <Form
          className="new-form-style contract-security-form"
          form={form}
          layout="vertical"
          onValuesChange={handleFormChange}>
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <div className="sla-form-card-container">
                <Typography.Text className="sla-form-card-title">
                  {t('label.refresh-frequency')}
                </Typography.Text>
                <Typography.Text className="sla-form-card-description">
                  {t('message.refresh-frequency-contract-description')}
                </Typography.Text>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      label={t('label.interval')}
                      name="refresh_frequency_interval"
                      rules={[
                        {
                          required: true,
                        },
                        {
                          type: 'number',
                          min: 0,
                        },
                      ]}>
                      <InputNumber
                        className="w-full"
                        data-testid="refresh-frequency-interval-input"
                        placeholder={t('label.enter-entity', {
                          entity: t('label.interval'),
                        })}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      required
                      label={t('label.unit')}
                      name="refresh_frequency_unit">
                      <Select
                        allowClear
                        data-testid="refresh-frequency-unit-select"
                        options={REFRESH_FREQUENCY_UNIT_OPTIONS}
                        placeholder={t('label.select-entity', {
                          entity: t('label.unit'),
                        })}
                        popupClassName="refresh-frequency-unit-select"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Col>
            <Col span={12}>
              <div className="sla-form-card-container">
                <Typography.Text className="sla-form-card-title">
                  {t('label.max-latency')}
                </Typography.Text>
                <Typography.Text className="sla-form-card-description">
                  {t('message.max-latency-contract-description')}
                </Typography.Text>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label={t('label.value')}
                      name="max_latency_value"
                      rules={[
                        {
                          required: true,
                        },
                        {
                          type: 'number',
                          min: 0,
                        },
                      ]}>
                      <InputNumber
                        className="w-full"
                        data-testid="max-latency-value-input"
                        placeholder={t('label.enter-entity', {
                          entity: t('label.value'),
                        })}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      required
                      label={t('label.unit')}
                      name="max_latency_unit">
                      <Select
                        allowClear
                        data-testid="max-latency-unit-select"
                        options={MAX_LATENCY_OPTIONS}
                        placeholder={t('label.select-entity', {
                          entity: t('label.unit'),
                        })}
                        popupClassName="max-latency-unit-select"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Col>
            <Col span={12}>
              <div className="sla-form-card-container">
                <Typography.Text className="sla-form-card-title">
                  {t('label.availability-time')}
                </Typography.Text>
                <Typography.Text className="sla-form-card-description">
                  {t('message.availability-time-contract-description')}
                </Typography.Text>
                <Typography.Text className="text-grey-muted text-xs m-b-xs" />

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label={t('label.time')} name="availabilityTime">
                      <TimePicker
                        className="availability-time-picker w-full"
                        data-testid="availability"
                        format={`${SLA_AVAILABILITY_TIME_FORMAT}`}
                        placeholder="09:00"
                        showNow={false}
                        suffixIcon={null}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={t('label.timezone')}
                      name="timezone"
                      tooltip={t(
                        'message.contract-sla-timezone-availability-default'
                      )}>
                      <Select
                        allowClear
                        showSearch
                        data-testid="timezone-select"
                        placeholder={t('label.select-entity', {
                          entity: t('label.timezone'),
                        })}
                        popupClassName="timezone-select">
                        {TIMEZONE_OPTIONS.map((item) => (
                          <Select.Option
                            data-testid={`timezone-item-${item.label}`}
                            key={item.value}>
                            <Tooltip title={item.label}>{item.label}</Tooltip>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Col>
            <Col span={12}>
              <div className="sla-form-card-container">
                <Typography.Text className="sla-form-card-title">
                  {t('label.retention')}
                </Typography.Text>
                <Typography.Text className="sla-form-card-description">
                  {t('message.time-line-data-retention-description')}
                </Typography.Text>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label={t('label.period')}
                      name="retention_period"
                      rules={[
                        {
                          required: true,
                        },
                        {
                          type: 'number',
                          min: 0,
                        },
                      ]}>
                      <InputNumber
                        className="w-full"
                        data-testid="retention-period-input"
                        placeholder={t('label.enter-entity', {
                          entity: t('label.period'),
                        })}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      required
                      label={t('label.unit')}
                      name="retention_unit">
                      <Select
                        allowClear
                        data-testid="retention-unit-select"
                        options={RETENTION_UNIT_OPTIONS}
                        placeholder={t('label.select-entity', {
                          entity: t('label.unit'),
                        })}
                        popupClassName="retention-unit-select"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Col>

            <Col span={12}>
              <div className="sla-form-card-container">
                <Typography.Text className="sla-form-card-title">
                  {t('label.column')}
                </Typography.Text>
                <Typography.Text className="sla-form-card-description">
                  {t('message.contract-sla-column-name-description')}
                </Typography.Text>

                <Form.Item label={t('label.column-name')} name="columnName">
                  <Select
                    allowClear
                    showSearch
                    data-testid="columnName-select"
                    filterOption={filterSelectOptions}
                    getPopupContainer={getPopupContainer}
                    id="columnName-select"
                    options={columnOptions}
                    placeholder={t('label.please-enter-entity-name', {
                      entity: t('label.column'),
                    })}
                  />
                </Form.Item>
              </div>
            </Col>
          </Row>
        </Form>
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          onClick={onPrev}>
          {buttonProps.prevLabel ?? t('label.previous')}
        </Button>
      </div>
    </>
  );
};
