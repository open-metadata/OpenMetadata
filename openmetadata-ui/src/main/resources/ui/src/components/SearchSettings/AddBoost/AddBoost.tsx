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
import Icon from '@ant-design/icons';
import { Button, Divider, Form, Input, Select, Slider, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-white.svg';
import { ReactComponent as Document } from '../../../assets/svg/document.svg';
import {
  FieldValueBoost,
  Modifier,
  Range,
} from '../../../generated/configuration/searchSettings';
import { modifierOptions } from '../../../utils/SearchSettingsUtils';
import './add-boost.less';

interface AddBoostProps {
  fieldValueBoosts: FieldValueBoost[];
  fieldName: string;
  onValueBoostChange: (fieldName: string, boost: FieldValueBoost) => void;
  onDeleteBoost: (fieldName: string) => void;
}

const AddBoost = ({
  fieldValueBoosts,
  fieldName,
  onValueBoostChange,
  onDeleteBoost,
}: AddBoostProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const currentBoost = fieldValueBoosts.find(
    (boost) => boost.field === fieldName
  );

  const [boostValue, setBoostValue] = useState<FieldValueBoost>({
    field: fieldName,
    factor: currentBoost?.factor ?? 0,
    modifier: currentBoost?.modifier ?? Modifier.None,
    missing: currentBoost?.missing ?? 0,
    condition: currentBoost?.condition ?? { range: {} },
  });

  useEffect(() => {
    form.setFieldsValue({
      modifier: boostValue.modifier,
      missing: boostValue.missing,
      range: boostValue.condition?.range,
    });
  }, []);

  const handleSliderChange = (value: number) => {
    const updatedBoost = { ...boostValue, factor: value };
    setBoostValue(updatedBoost);
    onValueBoostChange(fieldName, updatedBoost);
  };

  const handleModifierChange = (value: Modifier) => {
    const updatedBoost = { ...boostValue, modifier: value };
    setBoostValue(updatedBoost);
    onValueBoostChange(fieldName, updatedBoost);
  };

  const handleMissingValueChange = (value: number) => {
    const updatedBoost = { ...boostValue, missing: value };
    setBoostValue(updatedBoost);
    onValueBoostChange(fieldName, updatedBoost);
  };

  const handleRangeChange = (values: Range) => {
    const updatedBoost = {
      ...boostValue,
      condition: {
        range: values,
      },
    };
    setBoostValue(updatedBoost);
    onValueBoostChange(fieldName, updatedBoost);
  };

  const handleDelete = () => {
    onDeleteBoost(fieldName);
  };

  return (
    <div
      className="bg-white custom-panel add-boost-container"
      data-testid="add-boost-component">
      <div className="d-flex items-center gap-2 add-boost-header">
        <Icon className="text-xl" component={Document} />
        <Typography.Text className="font-medium" data-testid="boost-label">
          {t('label.value-boost')}
        </Typography.Text>
      </div>
      <Divider className="p-x-sm m-0" />
      <div className="m-y-sm p-box">
        <Form form={form} layout="vertical">
          {/* Factor/Impact Slider */}
          <div className="d-flex items-center justify-between m-b-md">
            <Typography.Text>{t('label.impact')}</Typography.Text>
            <Typography.Text
              className="font-semibold boost-value"
              data-testid="field-boost-value">
              {boostValue.factor}
            </Typography.Text>
          </div>
          <div className="m-b-lg" data-testid="field-boost-slider">
            <Slider
              max={10}
              min={0}
              tooltip={{ open: false }}
              value={boostValue.factor}
              onChange={handleSliderChange}
            />
          </div>

          {/* Modifier Select */}
          <Form.Item
            className="m-b-md"
            label={t('label.modifier')}
            name="modifier">
            <Select
              data-testid="modifier-select"
              options={modifierOptions}
              value={boostValue.modifier}
              onChange={handleModifierChange}
            />
          </Form.Item>

          {/* Missing Value Input */}
          <Form.Item
            className="m-b-md"
            label={t('label.missing-value')}
            name="missing">
            <Input
              data-testid="missing-value-input"
              min={1}
              type="number"
              value={boostValue.missing}
              onChange={(e) => handleMissingValueChange(Number(e.target.value))}
            />
          </Form.Item>

          {/* Range Condition */}
          <Typography.Text
            className="m-b-sm d-block"
            data-testid="range-condition-label">
            {t('label.range-condition')}
          </Typography.Text>
          <div className="range-inputs d-flex flex-col gap-1 m-b-lg">
            <div className="d-flex gap-2">
              <Form.Item className="flex-1" name={['range', 'gte']}>
                <Input
                  data-testid="gte-input"
                  min={1}
                  placeholder={t('label.greater-than-or-equal-to')}
                  type="number"
                  onChange={(e) =>
                    handleRangeChange({
                      ...boostValue.condition?.range,
                      gte: Number(e.target.value),
                    })
                  }
                />
              </Form.Item>
              <Form.Item className="flex-1" name={['range', 'lte']}>
                <Input
                  data-testid="lte-input"
                  min={1}
                  placeholder={t('label.less-than-or-equal-to')}
                  type="number"
                  onChange={(e) =>
                    handleRangeChange({
                      ...boostValue.condition?.range,
                      lte: Number(e.target.value),
                    })
                  }
                />
              </Form.Item>
            </div>
            <div className="d-flex gap-2">
              <Form.Item className="flex-1" name={['range', 'gt']}>
                <Input
                  data-testid="gt-input"
                  min={1}
                  placeholder={t('label.greater-than')}
                  type="number"
                  onChange={(e) =>
                    handleRangeChange({
                      ...boostValue.condition?.range,
                      gt: Number(e.target.value),
                    })
                  }
                />
              </Form.Item>
              <Form.Item className="flex-1" name={['range', 'lt']}>
                <Input
                  data-testid="lt-input"
                  min={1}
                  placeholder={t('label.less-than')}
                  type="number"
                  onChange={(e) =>
                    handleRangeChange({
                      ...boostValue.condition?.range,
                      lt: Number(e.target.value),
                    })
                  }
                />
              </Form.Item>
            </div>
          </div>

          <Divider />

          {/* Delete Button */}
          <div className="d-flex justify-end w-full">
            <Button
              className="delete-boost-btn d-flex items-center gap-2 border-none border-radius-card"
              data-testid="delete-boost-btn"
              onClick={handleDelete}>
              <Icon className="text-xl font-semibold" component={Delete} />
              <span className="text-sm">{t('label.delete-boost')}</span>
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default AddBoost;
