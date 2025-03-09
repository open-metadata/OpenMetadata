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
import { Button, Col, Row, Slider, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-white.svg';
import { TermBoost } from '../../../generated/configuration/searchSettings';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AsyncSelect } from '../../common/AsyncSelect/AsyncSelect';
import './term-boost.less';

interface TermBoostProps {
  termBoost: TermBoost;
  onTermBoostChange: (termBoost: TermBoost) => void;
  onDeleteBoost: (termValue: string) => void;
}

const TermBoostComponent: React.FC<TermBoostProps> = ({
  termBoost,
  onTermBoostChange,
  onDeleteBoost,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<TermBoost>({
    field: termBoost.field ?? '',
    value: termBoost.value ?? '',
    boost: termBoost.boost ?? 0,
  });

  const fetchTags = async (searchText: string) => {
    try {
      const response = await tagClassBase.getTags(searchText, 1, true);

      const formattedOptions = response.data.map((item) => {
        const fqn = item.data.fullyQualifiedName;
        let field = 'tags.tagFQN'; // default field

        // Determine field based on FQN pattern
        if (fqn?.startsWith('Certification.')) {
          field = 'certification.tagFQN';
        } else if (fqn?.startsWith('Tier.')) {
          field = 'tier.tagFQN';
        }

        return {
          label: (
            <div className="d-flex flex-column">
              <Typography.Text
                className="text-sm"
                data-testid="tag-option-label">
                {item.data.displayName ?? item.data.name}
              </Typography.Text>
              <Typography.Text
                className="text-grey-muted text-sm"
                data-testid="tag-option-fully-qualified-name">
                {fqn}
              </Typography.Text>
            </div>
          ),
          value: fqn,
          field: field,
        };
      });

      return formattedOptions;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return [];
    }
  };

  const handleTagChange = (value: string, option: any) => {
    const updatedData = {
      ...formData,
      field: option.field,
      value: value,
    };

    setFormData(updatedData);
  };

  const handleBoostChange = (value: number) => {
    const updatedData = { ...formData, boost: value };

    setFormData(updatedData);
  };

  const handleSave = () => {
    if (formData.field && formData.value && formData.boost) {
      onTermBoostChange(formData);
    }
  };

  return (
    <div className="m-t-md" style={{ minWidth: '300px' }}>
      <div className="m-b-sm p-sm tag-boost-header">
        <Row className="d-flex flex-column p-sm bg-white border-radius-card">
          <Col>
            <div className="d-flex items-center justify-between m-b-sm">
              <Typography.Text
                className="m-b-sm d-block"
                data-testid="term-boost-label">
                {t('label.term-boost')}
              </Typography.Text>
              <Icon
                className="font-semibold text-xl delete-icon"
                component={Delete}
                data-testid="delete-term-boost"
                onClick={() => onDeleteBoost(termBoost.value)}
              />
            </div>
          </Col>
          <Col>
            <AsyncSelect
              showSearch
              api={fetchTags}
              className="w-full"
              data-testid="term-boost-select"
              filterOption={(input, option) =>
                (option?.value?.toString().toLowerCase() ?? '').includes(
                  input.toLowerCase()
                )
              }
              optionLabelProp="value"
              options={[]}
              placeholder="Select a tag"
              value={formData.value}
              onChange={handleTagChange}
            />
          </Col>
          <Col className="m-t-sm">
            <div className="d-flex items-center justify-between">
              <Typography.Text data-testid="term-boost-impact-label">
                {t('label.impact')}
              </Typography.Text>
              <Typography.Text
                className="font-semibold boost-value"
                data-testid="term-boost-value">
                {formData.boost}
              </Typography.Text>
            </div>
            <div data-testid="term-boost-slider">
              <Slider
                max={50}
                min={0}
                tooltip={{ open: false }}
                value={formData.boost}
                onChange={handleBoostChange}
              />
            </div>
          </Col>
          <Col>
            <Button
              className="w-full"
              data-testid="save-term-boost"
              disabled={!formData.field || !formData.value || !formData.boost}
              type="primary"
              onClick={handleSave}>
              {t('label.save')}
            </Button>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default TermBoostComponent;
