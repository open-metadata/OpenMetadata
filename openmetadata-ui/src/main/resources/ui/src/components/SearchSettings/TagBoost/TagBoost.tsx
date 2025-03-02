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
import { Slider, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-white.svg';
import { TagBoost } from '../../../generated/configuration/searchSettings';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AsyncSelect } from '../../common/AsyncSelect/AsyncSelect';
import './tag-boost.less';
interface TagBoostProps {
  tagBoost: TagBoost;
  onTagBoostChange: (tagBoost: TagBoost) => void;
  onDeleteBoost: (tagFQN: string) => void;
}

const TagBoostComponent: React.FC<TagBoostProps> = ({
  tagBoost,
  onTagBoostChange,
  onDeleteBoost,
}) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState<TagBoost>({
    tagFQN: tagBoost.tagFQN ?? '',
    boost: tagBoost.boost ?? 0,
  });

  const fetchTags = async (searchText: string) => {
    try {
      const response = await tagClassBase.getTags(searchText, 1);
      const formattedOptions = response.data.map((item) => ({
        label: (
          <div className="d-flex flex-column">
            <Typography.Text className="text-sm" data-testid="tag-option-label">
              {item.data.displayName ?? item.data.name}
            </Typography.Text>
            <Typography.Text
              className="text-grey-muted text-sm"
              data-testid="tag-option-fully-qualified-name">
              {item.data.fullyQualifiedName}
            </Typography.Text>
          </div>
        ),
        value: item.data.fullyQualifiedName,
      }));

      return formattedOptions;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return [];
    }
  };

  const handleTagChange = (value: string) => {
    const updatedData = {
      ...formData,
      tagFQN: value,
    };
    setFormData(updatedData);
    handleUpdateTagBoost(updatedData);
  };

  const handleBoostChange = (value: number) => {
    const updatedData = { ...formData, boost: value };

    setFormData(updatedData);
    handleUpdateTagBoost(updatedData);
  };

  const handleUpdateTagBoost = (tagBoost: TagBoost) => {
    if (tagBoost.tagFQN && tagBoost.boost) {
      onTagBoostChange(tagBoost);
    }
  };

  return (
    <div className="m-t-md">
      <div className="m-b-sm p-sm tag-boost-header">
        <div className="d-flex items-center justify-between m-b-sm">
          <Typography.Text className="m-b-sm d-block" data-testid="tag-label">
            {t('label.tag')}
          </Typography.Text>
          <Icon
            className="font-semibold text-xl delete-icon"
            component={Delete}
            data-testid="delete-tag-boost"
            onClick={() => onDeleteBoost(tagBoost.tagFQN)}
          />
        </div>
        <AsyncSelect
          showSearch
          api={fetchTags}
          className="w-full"
          data-testid="tag-select"
          disabled={!!tagBoost.tagFQN}
          filterOption={(input, option) =>
            (option?.value?.toString().toLowerCase() ?? '').includes(
              input.toLowerCase()
            )
          }
          optionLabelProp="value"
          options={[]}
          placeholder="Select a tag"
          value={formData.tagFQN}
          onChange={handleTagChange}
        />

        <div className="m-t-lg">
          <div className="d-flex items-center justify-between">
            <Typography.Text data-testid="tag-impact-label">
              {t('label.impact')}
            </Typography.Text>
            <Typography.Text
              className="font-semibold boost-value"
              data-testid="tag-boost-value">
              {formData.boost}
            </Typography.Text>
          </div>
          <Slider
            max={10}
            min={0}
            tooltip={{ open: false }}
            value={formData.boost}
            onChange={handleBoostChange}
          />
        </div>
      </div>
    </div>
  );
};

export default TagBoostComponent;
