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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Input, Typography } from 'antd';
import { useState } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import '../../../pages/SearchSettingsPage/search-settings.less';
import InlineEdit from '../../common/InlineEdit/InlineEdit.component';
import './global-settings-item.less';

interface GlobalSettingItemProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onUpdate: (value: number) => Promise<void>;
}

export const GlobalSettingItem = ({
  label,
  value,
  min,
  max,
  onUpdate,
}: GlobalSettingItemProps) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [updatedValue, setUpdatedValue] = useState<number>(value);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      await onUpdate(updatedValue);
    } catch (error) {
      setUpdatedValue(value);

      throw error;
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setUpdatedValue(value);
    setIsEditing(false);
  };

  return (
    <div className="d-flex items-center justify-between p-y-xs global-settings-item">
      <Typography.Text data-testid="global-setting-label">
        {label}
      </Typography.Text>

      {isEditing ? (
        <div className="m-l-md d-flex justify-end flex-wrap inline-edit-container">
          <InlineEdit
            isLoading={isUpdating}
            onCancel={handleCancel}
            onSave={handleSave}>
            <Input
              data-testid="value-input"
              disabled={isUpdating}
              id="value"
              max={max}
              min={min}
              placeholder="value"
              type="number"
              value={updatedValue}
              onChange={(e) => setUpdatedValue(parseInt(e.target.value))}
            />
          </InlineEdit>
        </div>
      ) : (
        <div className="d-flex items-center justify-end flex-wrap value-container">
          <span
            className="m-l-xlg font-semibold p-x-xss global-settings-item-value"
            data-testid={`global-setting-value-${label}`}>
            {value}
          </span>
          <Icon
            className="m-l-sm flex-shrink"
            component={EditIcon}
            data-testid={`global-setting-edit-icon-${label}`}
            onClick={() => setIsEditing(true)}
          />
        </div>
      )}
    </div>
  );
};
