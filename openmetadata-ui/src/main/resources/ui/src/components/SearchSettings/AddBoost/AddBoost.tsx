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
import { Button, Divider, Slider, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-white.svg';
import { ReactComponent as Document } from '../../../assets/svg/document.svg';
import { FieldBoost } from '../../../generated/configuration/searchSettings';
import './add-boost.less';

interface AddBoostProps {
  boosts: FieldBoost[];
  fieldName: string;
  onBoostChange: (fieldName: string, boostValue: number) => void;
  onDeleteBoost: (fieldName: string) => void;
}

const AddBoost = ({
  boosts,
  fieldName,
  onBoostChange,
  onDeleteBoost,
}: AddBoostProps) => {
  const { t } = useTranslation();
  const currentBoost =
    boosts.find((boost) => boost.field === fieldName)?.boost ?? 0;

  const handleSliderChange = (value: number) => {
    onBoostChange(fieldName, value);
  };

  const handleDelete = () => {
    onDeleteBoost(fieldName);
  };

  return (
    <div className="bg-white custom-panel add-boost-container">
      <div className="d-flex items-center gap-2 add-boost-header">
        <Icon className="text-xl" component={Document} />
        <Typography.Text className="font-medium" data-testid="boost-label">
          {t('label.value-boost')}
        </Typography.Text>
      </div>
      <Divider className="p-x-sm m-0" />
      <div className="m-y-sm p-box">
        <div className="d-flex items-center justify-between">
          <Typography.Text>{t('label.impact')}</Typography.Text>
          <Typography.Text
            className="font-semibold boost-value"
            data-testid="boost-value">
            {currentBoost}
          </Typography.Text>
        </div>
        <Slider
          disabled={false}
          max={10}
          min={0}
          tooltip={{ open: false }}
          value={currentBoost}
          onChange={handleSliderChange}
        />
        <Divider />
        <div className="d-flex justify-end w-full">
          <Button
            className="delete-boost-btn d-flex items-center gap-2 border-none border-radius-card "
            data-testid="delete-boost-btn"
            onClick={handleDelete}>
            <Icon className="text-xl font-semibold" component={Delete} />
            <span className="text-sm">{t('label.delete-boost')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddBoost;
