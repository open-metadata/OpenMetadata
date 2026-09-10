/*
 *  Copyright 2026 Collate.
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
import { Col, Form, FormInstance, Input, Row, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DIMENSION_COLOR_PALETTE } from '../../constants/DataQualityDimension.constants';

export interface DimensionFormValues {
  name: string;
  displayName?: string;
  description?: string;
  color: string;
}

export interface DimensionFormProps {
  form: FormInstance<DimensionFormValues>;
  initialValues: DimensionFormValues;
  /** Remounts the form so fields start from the dimension being edited. */
  formKey: string;
  isEditing: boolean;
  watchedColor: string;
  /** Pre-resolved so the preview needs no fallback chain of its own. */
  previewLabel: string;
  onFinish: (values: DimensionFormValues) => void;
}

const DimensionForm = ({
  form,
  initialValues,
  formKey,
  isEditing,
  watchedColor,
  previewLabel,
  onFinish,
}: DimensionFormProps) => {
  const { t } = useTranslation();

  return (
    <Form<DimensionFormValues>
      className="new-form-style"
      form={form}
      initialValues={initialValues}
      key={formKey}
      layout="vertical"
      onFinish={onFinish}>
      <Row className="dimension-form" gutter={[24, 0]}>
        <Col span={15}>
          <Form.Item
            extra={
              isEditing
                ? t('message.dimension-name-is-fixed-after-creation')
                : t('message.dimension-name-help')
            }
            label={t('label.name')}
            name="name"
            rules={[
              {
                required: true,
                message: t('label.field-required', { field: t('label.name') }),
              },
              {
                pattern: /^[\w-]+$/,
                message: t('message.dimension-name-help'),
              },
            ]}>
            {/* The name is referenced by the API and by every test case relationship, so it is
                read-only once the dimension exists. */}
            <Input data-testid="dimension-name" disabled={isEditing} />
          </Form.Item>
          <Form.Item
            extra={t('message.dimension-display-name-help')}
            label={t('label.display-name')}
            name="displayName">
            <Input data-testid="dimension-display-name" />
          </Form.Item>
          <Form.Item label={t('label.description')} name="description">
            <Input.TextArea
              data-testid="dimension-description"
              placeholder={t('message.dimension-description-placeholder')}
              rows={4}
            />
          </Form.Item>
          {/* The colour is held by the form itself — the swatches below write to it — so that
              the preview re-renders from a watcher instead of from local state. */}
          <Form.Item hidden name="color">
            <Input />
          </Form.Item>
          <Form.Item label={t('label.color')}>
            <Space wrap size={8}>
              {DIMENSION_COLOR_PALETTE.map((color) => (
                <button
                  aria-label={color}
                  aria-pressed={watchedColor === color}
                  className={`dimension-color-swatch${
                    watchedColor === color ? ' selected' : ''
                  }`}
                  data-testid={`color-${color}`}
                  key={color}
                  style={{ backgroundColor: color }}
                  type="button"
                  onClick={() => form.setFieldValue('color', color)}
                />
              ))}
            </Space>
          </Form.Item>
        </Col>
        <Col span={9}>
          <div className="dimension-side-panel">
            <Typography.Text type="secondary">
              {t('label.preview')}
            </Typography.Text>
            <div className="dimension-preview">
              <span
                className="dimension-color-dot"
                style={{ backgroundColor: watchedColor }}
              />
              <Typography.Text strong>{previewLabel}</Typography.Text>
            </div>
            <Typography.Paragraph className="m-b-0" type="secondary">
              {t('message.data-quality-dimensions-description')}
            </Typography.Paragraph>
          </div>
        </Col>
      </Row>
    </Form>
  );
};

export default DimensionForm;
