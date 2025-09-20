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

import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Recognizer,
  RecognizerConfig,
  RecognizerType,
} from '../../../generated/type/recognizer';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface RecognizerEditorProps {
  recognizers: Recognizer[];
  onRecognizersChange: (recognizers: Recognizer[]) => void;
  isReadOnly?: boolean;
}

interface PatternFormValues {
  name: string;
  regex: string;
  score: number;
}

interface RecognizerFormValues {
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  confidenceThreshold: number;
  supportedLanguages: string[];
  recognizerType: RecognizerType;
  supportedEntity: string;
  patterns?: PatternFormValues[];
  denyList?: string[];
  contextWords?: string[];
  caseSensitive?: boolean;
  minScore?: number;
  maxScore?: number;
}

const RecognizerEditor: React.FC<RecognizerEditorProps> = ({
  recognizers = [],
  onRecognizersChange,
  isReadOnly = false,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<RecognizerFormValues>();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<RecognizerType>('pattern');

  const handleAddRecognizer = useCallback(() => {
    form.resetFields();
    setEditingIndex(null);
    setSelectedType('pattern');
    setIsModalVisible(true);
  }, [form]);

  const handleEditRecognizer = useCallback(
    (index: number) => {
      const recognizer = recognizers[index];
      const config = recognizer.recognizerConfig;
      
      let formValues: RecognizerFormValues = {
        name: recognizer.name,
        displayName: recognizer.displayName,
        description: recognizer.description,
        enabled: recognizer.enabled ?? true,
        confidenceThreshold: recognizer.confidenceThreshold ?? 0.6,
        supportedLanguages: recognizer.supportedLanguages ?? ['en'],
        recognizerType: config.type,
        supportedEntity: config.supportedEntity,
      };

      if (config.type === 'pattern' && 'patterns' in config) {
        formValues.patterns = config.patterns;
      } else if (config.type === 'deny_list' && 'denyList' in config) {
        formValues.denyList = config.denyList;
        formValues.caseSensitive = config.caseSensitive;
      } else if (config.type === 'context' && 'contextWords' in config) {
        formValues.contextWords = config.contextWords;
        formValues.minScore = config.minScore;
        formValues.maxScore = config.maxScore;
      }

      form.setFieldsValue(formValues);
      setSelectedType(config.type);
      setEditingIndex(index);
      setIsModalVisible(true);
    },
    [recognizers, form]
  );

  const handleDeleteRecognizer = useCallback(
    (index: number) => {
      Modal.confirm({
        title: t('message.confirm-delete-recognizer'),
        content: t('message.delete-recognizer-warning'),
        onOk: () => {
          const newRecognizers = [...recognizers];
          newRecognizers.splice(index, 1);
          onRecognizersChange(newRecognizers);
          showSuccessToast(t('message.recognizer-deleted'));
        },
      });
    },
    [recognizers, onRecognizersChange, t]
  );

  const handleModalOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      
      let recognizerConfig: RecognizerConfig;
      
      if (values.recognizerType === 'pattern') {
        recognizerConfig = {
          type: 'pattern',
          supportedEntity: values.supportedEntity,
          patterns: values.patterns ?? [],
        };
      } else if (values.recognizerType === 'deny_list') {
        recognizerConfig = {
          type: 'deny_list',
          supportedEntity: values.supportedEntity,
          denyList: values.denyList ?? [],
          caseSensitive: values.caseSensitive ?? false,
        };
      } else if (values.recognizerType === 'context') {
        recognizerConfig = {
          type: 'context',
          supportedEntity: values.supportedEntity,
          contextWords: values.contextWords ?? [],
          minScore: values.minScore ?? 0.4,
          maxScore: values.maxScore ?? 0.8,
        };
      } else {
        recognizerConfig = {
          type: 'custom',
          supportedEntity: values.supportedEntity,
        };
      }

      const newRecognizer: Recognizer = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        enabled: values.enabled,
        confidenceThreshold: values.confidenceThreshold,
        supportedLanguages: values.supportedLanguages,
        recognizerConfig,
        isSystemDefault: false,
      };

      const newRecognizers = [...recognizers];
      if (editingIndex !== null) {
        newRecognizers[editingIndex] = newRecognizer;
        showSuccessToast(t('message.recognizer-updated'));
      } else {
        newRecognizers.push(newRecognizer);
        showSuccessToast(t('message.recognizer-added'));
      }

      onRecognizersChange(newRecognizers);
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      showErrorToast(t('message.recognizer-save-error'));
    }
  }, [form, recognizers, editingIndex, onRecognizersChange, t]);

  const columns: ColumnsType<Recognizer> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: '20%',
      },
      {
        title: t('label.type'),
        dataIndex: ['recognizerConfig', 'type'],
        key: 'type',
        width: '15%',
        render: (type: RecognizerType) => (
          <Text>{type.replace('_', ' ').toUpperCase()}</Text>
        ),
      },
      {
        title: t('label.entity'),
        dataIndex: ['recognizerConfig', 'supportedEntity'],
        key: 'entity',
        width: '20%',
      },
      {
        title: t('label.confidence'),
        dataIndex: 'confidenceThreshold',
        key: 'confidence',
        width: '15%',
        render: (value: number) => `${(value * 100).toFixed(0)}%`,
      },
      {
        title: t('label.enabled'),
        dataIndex: 'enabled',
        key: 'enabled',
        width: '10%',
        render: (enabled: boolean) => (
          <Switch checked={enabled} disabled />
        ),
      },
      {
        title: t('label.actions'),
        key: 'actions',
        width: '20%',
        render: (_, record, index) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEditRecognizer(index)}
              disabled={isReadOnly || record.isSystemDefault}
              size="small"
            />
            <Button
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteRecognizer(index)}
              disabled={isReadOnly || record.isSystemDefault}
              danger
              size="small"
            />
          </Space>
        ),
      },
    ],
    [t, isReadOnly, handleEditRecognizer, handleDeleteRecognizer]
  );

  const renderPatternFields = () => (
    <Form.List name="patterns">
      {(fields, { add, remove }) => (
        <>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Button
                type="dashed"
                onClick={() => add({ name: '', regex: '', score: 0.8 })}
                block
                icon={<PlusOutlined />}>
                {t('label.add-pattern')}
              </Button>
            </Col>
          </Row>
          {fields.map(({ key, name, ...restField }) => (
            <Card key={key} size="small" style={{ marginTop: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    label={t('label.pattern-name')}
                    rules={[{ required: true, message: t('message.field-required') }]}>
                    <Input placeholder="e.g., us_phone" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[name, 'regex']}
                    label={t('label.regex')}
                    rules={[{ required: true, message: t('message.field-required') }]}>
                    <Input placeholder="e.g., \b\d{3}-\d{2}-\d{4}\b" />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item
                    {...restField}
                    name={[name, 'score']}
                    label={t('label.score')}>
                    <InputNumber min={0} max={1} step={0.1} />
                  </Form.Item>
                </Col>
                <Col span={1}>
                  <Button
                    type="text"
                    onClick={() => remove(name)}
                    icon={<DeleteOutlined />}
                    danger
                  />
                </Col>
              </Row>
            </Card>
          ))}
        </>
      )}
    </Form.List>
  );

  const renderDenyListFields = () => (
    <>
      <Form.Item
        name="denyList"
        label={t('label.deny-list')}
        rules={[{ required: true, message: t('message.field-required') }]}>
        <Select
          mode="tags"
          placeholder={t('placeholder.enter-values')}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item
        name="caseSensitive"
        label={t('label.case-sensitive')}
        valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );

  const renderContextFields = () => (
    <>
      <Form.Item
        name="contextWords"
        label={t('label.context-words')}
        rules={[{ required: true, message: t('message.field-required') }]}>
        <Select
          mode="tags"
          placeholder={t('placeholder.enter-context-words')}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="minScore"
            label={t('label.min-score')}>
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="maxScore"
            label={t('label.max-score')}>
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  return (
    <div className="recognizer-editor">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={5}>{t('label.recognizers')}</Title>
                <Paragraph type="secondary">
                  {t('message.recognizers-description')}
                </Paragraph>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddRecognizer}
                  disabled={isReadOnly}>
                  {t('label.add-recognizer')}
                </Button>
              </Col>
            </Row>
            
            <Table
              columns={columns}
              dataSource={recognizers}
              rowKey="name"
              pagination={false}
              locale={{
                emptyText: t('message.no-recognizers'),
              }}
            />
          </Space>
        </Col>
      </Row>

      <Modal
        title={editingIndex !== null ? t('label.edit-recognizer') : t('label.add-recognizer')}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            enabled: true,
            confidenceThreshold: 0.6,
            supportedLanguages: ['en'],
            recognizerType: 'pattern',
          }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('label.name')}
                rules={[{ required: true, message: t('message.field-required') }]}>
                <Input placeholder={t('placeholder.recognizer-name')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="displayName"
                label={t('label.display-name')}>
                <Input placeholder={t('placeholder.recognizer-display-name')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label={t('label.description')}>
            <TextArea rows={2} placeholder={t('placeholder.recognizer-description')} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="recognizerType"
                label={t('label.recognizer-type')}
                rules={[{ required: true, message: t('message.field-required') }]}>
                <Select onChange={setSelectedType}>
                  <Option value="pattern">{t('label.pattern')}</Option>
                  <Option value="deny_list">{t('label.deny-list')}</Option>
                  <Option value="context">{t('label.context')}</Option>
                  <Option value="custom">{t('label.custom')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="supportedEntity"
                label={t('label.supported-entity')}
                rules={[{ required: true, message: t('message.field-required') }]}>
                <Input placeholder="e.g., EMAIL_ADDRESS, SSN" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="confidenceThreshold"
                label={t('label.confidence-threshold')}>
                <InputNumber
                  min={0}
                  max={1}
                  step={0.1}
                  style={{ width: '100%' }}
                  formatter={(value) => `${(Number(value) * 100).toFixed(0)}%`}
                  parser={(value) => Number(value?.replace('%', '')) / 100}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="supportedLanguages"
                label={t('label.supported-languages')}>
                <Select mode="multiple" defaultValue={['en']}>
                  <Option value="en">{t('label.language-english')}</Option>
                  <Option value="es">{t('label.language-spanish')}</Option>
                  <Option value="fr">{t('label.language-french')}</Option>
                  <Option value="de">{t('label.language-german')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="enabled"
                label={t('label.enabled')}
                valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          {selectedType === 'pattern' && renderPatternFields()}
          {selectedType === 'deny_list' && renderDenyListFields()}
          {selectedType === 'context' && renderContextFields()}
        </Form>
      </Modal>
    </div>
  );
};

export default RecognizerEditor;