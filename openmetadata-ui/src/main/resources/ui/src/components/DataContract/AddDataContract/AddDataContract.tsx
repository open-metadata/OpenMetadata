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
/* eslint-disable i18next/no-literal-string */
import {
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Tabs,
  TimePicker,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';
import Table from '../../common/Table/Table';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';

const ContractDetail = () => {
  const { t } = useTranslation();
  const fields: FieldProp[] = [
    {
      label: t('label.contract-title'),
      id: 'contractTitle',
      name: 'contractTitle',
      type: FieldTypes.TEXT,
      required: true,
    },
    {
      label: t('label.contract-description'),
      id: 'contractDescription',
      name: 'contractDescription',
      type: FieldTypes.DESCRIPTION,
      required: true,
    },
    {
      label: t('label.owner'),
      id: 'owner',
      name: 'owner',
      type: FieldTypes.USER_TEAM_SELECT,
      required: true,
    },
    {
      label: t('label.enable-incident-management'),
      id: 'enableIncidentManagement',
      name: 'enableIncidentManagement',
      type: FieldTypes.SWITCH,
      required: true,
    },
  ];

  return (
    <div className="container">
      <Card title={t('label.contract-detail-plural')}>
        <Form>{generateFormFields(fields)}</Form>
      </Card>
    </div>
  );
};

const Schema = () => {
  const { t } = useTranslation();
  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.type'),
        dataIndex: 'type',
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'glossaryTerms',
      },
      {
        title: t('label.contraint-plural'),
        dataIndex: 'contraints',
      },
    ],
    [t]
  );

  return <Table columns={columns} dataSource={[]} />;
};

const Semantics = () => {
  const { t } = useTranslation();

  return (
    <div className="container">
      <Typography.Title level={5}>{t('label.semantics')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('label.semantics-description')}
      </Typography.Text>
      <Collapse>
        <Collapse.Panel header="Table checks configuration" key="table-checks">
          <Card>Table checks confirguration</Card>
        </Collapse.Panel>
        <Collapse.Panel
          header="Column checks configuration"
          key="column-checks">
          <Card>Column checks configuration</Card>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

const Security = () => {
  const { t } = useTranslation();

  const fields: FieldProp[] = [
    {
      label: t('label.access-policy-name'),
      id: 'accessPolicyName',
      name: 'accessPolicyName',
      type: FieldTypes.TEXT,
      required: true,
    },
    {
      label: t('label.data-classification'),
      id: 'dataClassification',
      name: 'dataClassification',
      type: FieldTypes.TAG_SUGGESTION,
      required: true,
    },
  ];

  return (
    <div className="container">
      <Typography.Title level={5}>{t('label.security')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('label.security-description')}
      </Typography.Text>

      <Card>
        <Form>{generateFormFields(fields)}</Form>
      </Card>
    </div>
  );
};

const Quality = () => {
  const [testType, setTestType] = useState<'table' | 'column'>('table');

  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
      },
    ],
    [t]
  );

  return (
    <div className="container">
      <Typography.Title level={5}>{t('label.quality')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('label.quality-description')}
      </Typography.Text>
      <Card>
        <Radio.Group
          value={testType}
          onChange={(e) => setTestType(e.target.value)}>
          <Radio.Button value="table">Table</Radio.Button>
          <Radio.Button value="column">Column</Radio.Button>
        </Radio.Group>
        <Table columns={columns} dataSource={[]} />
      </Card>
    </div>
  );
};

const Sla = () => {
  const { t } = useTranslation();

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
            <Form layout="horizontal">
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
            <Form layout="horizontal">
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
            <Form layout="horizontal">
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
            <Form layout="horizontal">
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

export const AddDataContract = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'YAML' | 'UI'>('UI');
  const [yaml, setYaml] = useState('');

  const items = useMemo(
    () => [
      {
        label: t('label.contract-detail-plural'),
        key: 'contract-detail',
        children: <ContractDetail />,
      },
      {
        label: t('label.schema'),
        key: 'schema',
        children: <Schema />,
      },
      {
        label: t('label.semantics'),
        key: 'semantics',
        children: <Semantics />,
      },
      {
        label: t('label.security'),
        key: 'security',
        children: <Security />,
      },
      {
        label: t('label.quality'),
        key: 'quality',
        children: <Quality />,
      },
      {
        label: t('label.sla'),
        key: 'sla',
        children: <Sla />,
      },
    ],
    [t]
  );

  const cardTitle = useMemo(() => {
    return (
      <Space className="w-full">
        <div className="d-flex item-center justify-between">
          <Typography.Title level={5}>{t('label.schema')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('label.yaml-mode-description')}
          </Typography.Text>
          <div>
            <Button.Group>
              <Button
                type={mode === 'YAML' ? 'primary' : 'default'}
                onClick={() => setMode('YAML')}>
                {t('label.yaml-mode')}
              </Button>
              <Button
                type={mode === 'UI' ? 'primary' : 'default'}
                onClick={() => setMode('UI')}>
                {t('label.ui-mode')}
              </Button>
            </Button.Group>
          </div>
        </div>
        <div>
          <Button type="default">{t('label.cancel')}</Button>
          <Button type="primary">{t('label.save')}</Button>
        </div>
      </Space>
    );
  }, [mode, t]);

  const cardContent = useMemo(() => {
    if (mode === 'YAML') {
      return (
        <SchemaEditor
          mode={{ name: CSMode.YAML }}
          value={yaml}
          onChange={setYaml}
        />
      );
    }

    return <Tabs items={items} tabPosition="left" />;
  }, [mode, items, t]);

  return <Card title={cardTitle}>{cardContent}</Card>;
};
