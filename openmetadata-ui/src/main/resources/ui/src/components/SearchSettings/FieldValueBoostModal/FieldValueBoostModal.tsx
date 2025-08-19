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
import { Form, Input, Modal, Slider, Typography } from 'antd';
import { Select } from '../../common/AntdCompat';;
import { useForm } from 'antd/lib/form/Form';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FieldValueBoost,
  Modifier,
} from '../../../generated/configuration/searchSettings';
import { modifierOptions } from '../../../utils/SearchSettingsUtils';

interface FieldValueBoostModalProps {
  open: boolean;
  entityOptions: string[];
  selectedBoost?: FieldValueBoost;
  onSave: (values: FieldValueBoost) => void;
  onCancel: () => void;
}

const FieldValueBoostModal: React.FC<FieldValueBoostModalProps> = ({
  open,
  entityOptions,
  selectedBoost,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [factor, setFactor] = useState<number>(selectedBoost?.factor ?? 0);

  useEffect(() => {
    if (selectedBoost) {
      form.setFieldsValue({
        field: selectedBoost.field,
        factor: selectedBoost.factor,
        modifier: selectedBoost.modifier,
        missing: selectedBoost.missing,
        condition: selectedBoost.condition,
      });
      setFactor(selectedBoost.factor ?? 1);
    } else {
      form.resetFields();
      setFactor(0);
    }
  }, [selectedBoost, open]);

  const handleFactorChange = (value: number) => {
    setFactor(value);
    form.setFieldValue('factor', value);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const fieldName = values.field;

      if (!fieldName) {
        return;
      }

      const condition = {
        range: {
          ...(values.condition?.range?.gte !== undefined && {
            gte: Number(values.condition.range.gte),
          }),
          ...(values.condition?.range?.lte !== undefined && {
            lte: Number(values.condition.range.lte),
          }),
          ...(values.condition?.range?.gt !== undefined && {
            gt: Number(values.condition.range.gt),
          }),
          ...(values.condition?.range?.lt !== undefined && {
            lt: Number(values.condition.range.lt),
          }),
        },
      };

      onSave({
        field: fieldName,
        factor: factor,
        modifier: values.modifier ?? Modifier.None,
        missing: values.missing ? Number(values.missing) : 0,
        condition,
      });
    });
  };

  return (
    <Modal
      centered
      destroyOnClose
      className="field-value-boost-modal"
      data-testid="field-value-boost-modal"
      okButtonProps={{ disabled: !form.getFieldValue('field') }}
      okText={t('label.save')}
      open={open}
      title={
        <Typography.Text strong>
          {selectedBoost
            ? t('label.edit-entity', { entity: t('label.field-value-boost') })
            : t('label.add-entity', { entity: t('label.field-value-boost') })}
        </Typography.Text>
      }
      width={600}
      onCancel={onCancel}
      onOk={handleSubmit}>
      <Form
        form={form}
        initialValues={{
          factor: 0,
          modifier: Modifier.None,
          missing: 0,
          condition: { range: {} },
        }}
        layout="vertical">
        <Form.Item
          data-testid="field"
          label={t('label.field')}
          name="field"
          rules={[{ required: true, message: t('message.field-required') }]}>
          <Select
            showSearch
            disabled={!!selectedBoost?.field}
            filterOption={(input, option) =>
              (option?.label as string)
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            options={entityOptions.map((field) => ({
              label: field,
              value: field,
            }))}
            placeholder={t('label.select-field')}
          />
        </Form.Item>

        <Form.Item>
          <div className="d-flex items-center justify-between m-b-md">
            <Typography.Text>{t('label.impact')}</Typography.Text>
            <Typography.Text
              className="font-semibold boost-value"
              data-testid="field-boost-value">
              {factor}
            </Typography.Text>
          </div>
          <div className="m-b-lg" data-testid="field-boost-slider">
            <Slider
              max={100}
              min={0}
              tooltip={{ open: false }}
              value={factor}
              onChange={handleFactorChange}
            />
          </div>
        </Form.Item>

        <Form.Item
          className="m-b-md"
          label={t('label.modifier')}
          name="modifier">
          <Select data-testid="modifier-select" options={modifierOptions} />
        </Form.Item>

        <Form.Item
          className="m-b-md"
          label={t('label.missing-value')}
          name="missing">
          <Input data-testid="missing-value-input" min={1} type="number" />
        </Form.Item>

        <Typography.Text
          className="m-b-sm d-block"
          data-testid="range-condition">
          {t('label.range-condition')}
        </Typography.Text>
        <div className="range-inputs d-flex flex-col gap-1">
          <div className="d-flex gap-2">
            <Form.Item className="flex-1" name={['condition', 'range', 'gte']}>
              <Input
                data-testid="gte-input"
                min={1}
                placeholder={t('label.greater-than-or-equal-to')}
                type="number"
              />
            </Form.Item>
            <Form.Item className="flex-1" name={['condition', 'range', 'lte']}>
              <Input
                data-testid="lte-input"
                min={1}
                placeholder={t('label.less-than-or-equal-to')}
                type="number"
              />
            </Form.Item>
          </div>
          <div className="d-flex gap-2">
            <Form.Item className="flex-1" name={['condition', 'range', 'gt']}>
              <Input
                data-testid="gt-input"
                min={1}
                placeholder={t('label.greater-than')}
                type="number"
              />
            </Form.Item>
            <Form.Item className="flex-1" name={['condition', 'range', 'lt']}>
              <Input
                data-testid="lt-input"
                min={1}
                placeholder={t('label.less-than')}
                type="number"
              />
            </Form.Item>
          </div>
        </div>
      </Form>
    </Modal>
  );
};

export default FieldValueBoostModal;
