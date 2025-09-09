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
  Input,
  Row,
  Select,
  TimePicker,
  Typography,
} from 'antd';
import { FormProps } from 'antd/lib/form/Form';
import moment from 'moment';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { SLA_AVAILABILITY_TIME_FORMAT } from '../../../constants/DataContract.constants';
import {
  DataContract,
  MaxLatencyUnit,
  RefreshFrequencyUnit,
  RetentionUnit,
} from '../../../generated/entity/data/dataContract';
import { enumToSelectOptions } from '../../../utils/DataContract/DataContractUtils';
import './contract-sla-form-tab.less';

export const ContractSLAFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  prevLabel?: string;
}> = ({ onChange, onPrev, prevLabel, initialValues }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const {
    RETENTION_UNIT_OPTIONS,
    MAX_LATENCY_OPTIONS,
    REFRESH_FREQUENCY_UNIT_OPTIONS,
  } = useMemo(() => {
    return {
      REFRESH_FREQUENCY_UNIT_OPTIONS: enumToSelectOptions(RefreshFrequencyUnit),
      RETENTION_UNIT_OPTIONS: enumToSelectOptions(RetentionUnit),
      MAX_LATENCY_OPTIONS: enumToSelectOptions(MaxLatencyUnit),
    };
  }, []);

  const handleFormChange: FormProps['onValuesChange'] = async (_, values) => {
    onChange({
      sla: {
        // Convert dayjs object to "HH:mm" format string for storage
        availabilityTime: values.availabilityTime
          ? values.availabilityTime.format('HH:mm')
          : undefined,
        maxLatency: {
          unit: values.max_latency_unit,
          value: values.max_latency_value,
        },
        refreshFrequency: {
          interval: values.refresh_frequency_interval,
          unit: values.refresh_frequency_unit,
        },
        retention: {
          period: values.retention_period,
          unit: values.retention_unit,
        },
      },
    });
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
                      required
                      label={t('label.interval')}
                      name="refresh_frequency_interval">
                      <Input
                        data-testid="refresh-frequency-interval-input"
                        min={0}
                        type="number"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      required
                      label={t('label.unit')}
                      name="refresh_frequency_unit">
                      <Select
                        data-testid="refresh-frequency-unit-select"
                        options={REFRESH_FREQUENCY_UNIT_OPTIONS}
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
                      required
                      label={t('label.value')}
                      name="max_latency_value">
                      <Input
                        data-testid="max-latency-value-input"
                        min={0}
                        type="number"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      required
                      label={t('label.unit')}
                      name="max_latency_unit">
                      <Select
                        data-testid="max-latency-unit-select"
                        options={MAX_LATENCY_OPTIONS}
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
                <Form.Item label={t('label.time')} name="availabilityTime">
                  <TimePicker
                    className="availability-time-picker"
                    data-testid="availability"
                    format={`${SLA_AVAILABILITY_TIME_FORMAT} [UTC]`}
                    placeholder="09:00 UTC"
                    showNow={false}
                    suffixIcon={null}
                  />
                </Form.Item>
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
                      required
                      label={t('label.period')}
                      name="retention_period">
                      <Input
                        data-testid="retention-period-input"
                        min={0}
                        type="number"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      required
                      label={t('label.unit')}
                      name="retention_unit">
                      <Select
                        data-testid="retention-unit-select"
                        options={RETENTION_UNIT_OPTIONS}
                        popupClassName="retention-unit-select"
                      />
                    </Form.Item>
                  </Col>
                </Row>
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
          {prevLabel ?? t('label.previous')}
        </Button>
      </div>
    </>
  );
};
