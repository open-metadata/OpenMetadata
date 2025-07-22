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
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  TimePicker,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';

export const ContractSLAFormTab: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  return (
    <div className="container">
      <Typography.Title level={5}>{t('label.sla')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('label.sla-description')}
      </Typography.Text>
      <Row>
        <Col span={12}>
          <Card>
            <Typography.Title level={5}>
              {t('label.refresh-frequency')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('message.refresh-frequency-description')}
            </Typography.Text>
            <Form form={form} layout="horizontal" name="contract-sla-form">
              <Form.Item label={t('label.interval')} name="interval">
                <Input type="number" />
              </Form.Item>
              <Form.Item required label={t('label.unit')} name="unit">
                <Select
                  options={[
                    { label: 'Hour', value: 'hour' },
                    { label: 'Day', value: 'day' },
                    { label: 'Week', value: 'week' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Typography.Title level={5}>
              {t('label.max-latency')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('message.max-latency-description')}
            </Typography.Text>
            <Form form={form} layout="horizontal" name="contract-sla-form">
              <Form.Item label={t('label.value')} name="value">
                <Input type="number" />
              </Form.Item>
              <Form.Item required label={t('label.unit')} name="unit">
                <Select
                  options={[
                    { label: 'Hour', value: 'hour' },
                    { label: 'Day', value: 'day' },
                    { label: 'Week', value: 'week' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Typography.Title level={5}>
              {t('label.availability-time')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('message.availability-time-description')}
            </Typography.Text>
            <Form form={form} layout="horizontal" name="contract-sla-form">
              <Form.Item label={t('label.time')} name="time">
                <TimePicker />
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Typography.Title level={5}>
              {t('label.retention')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('message.retention-description')}
            </Typography.Text>
            <Form form={form} layout="horizontal" name="contract-sla-form">
              <Form.Item label={t('label.period')} name="period">
                <Input type="number" />
              </Form.Item>
              <Form.Item required label={t('label.unit')} name="unit">
                <Select
                  options={[
                    { label: 'Hour', value: 'hour' },
                    { label: 'Day', value: 'day' },
                    { label: 'Week', value: 'week' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
