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
import Icon, { DownOutlined } from '@ant-design/icons';
import { Button, Col, Row, Slider, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-colored.svg';
import { ReactComponent as Document } from '../../../assets/svg/document.svg';
import { ReactComponent as Save } from '../../../assets/svg/save.svg';
import { TermBoost } from '../../../generated/configuration/searchSettings';
import { getFilterOptions } from '../../../utils/SearchSettingsUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AsyncSelect } from '../../common/AsyncSelect/AsyncSelect';
import './term-boost.less';

interface TermBoostProps {
  termBoost: TermBoost;
  onTermBoostChange: (termBoost: TermBoost) => void;
  onDeleteBoost: (termValue: string) => void;
  showNewTermBoost?: boolean;
}

const TermBoostComponent: React.FC<TermBoostProps> = ({
  termBoost,
  onTermBoostChange,
  onDeleteBoost,
  showNewTermBoost,
}) => {
  const { t } = useTranslation();
  const [termBoostData, setTermBoostData] = useState<TermBoost>({
    field: '',
    value: '',
    boost: 0,
  });

  const isNewBoost = showNewTermBoost || (!termBoost.field && !termBoost.value);

  useEffect(() => {
    if (!isNewBoost) {
      setTermBoostData({
        field: termBoost.field,
        value: termBoost.value,
        boost: termBoost.boost,
      });
    }
  }, [termBoost, isNewBoost]);

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
      ...termBoostData,
      field: option.field,
      value: value,
    };

    setTermBoostData(updatedData);
  };

  const handleBoostChange = (value: number) => {
    const updatedData = { ...termBoostData, boost: value };

    setTermBoostData(updatedData);
  };

  const handleSave = () => {
    if (termBoostData.field && termBoostData.value && termBoostData.boost) {
      onTermBoostChange(termBoostData);
    }
  };

  return (
    <div className="term-boost">
      <Row className="p-box d-flex items-center justify-between term-boost-header">
        <Col className="d-flex items-center gap-2">
          <Icon className="text-md" component={Document} />
          <Typography.Text
            className="text-sm font-medium"
            data-testid="term-boost-label">
            {t('label.term-boost')}
          </Typography.Text>
        </Col>
        <Col className="d-flex items-center gap-2">
          <Button
            className="delete-term-boost"
            data-testid="delete-term-boost"
            icon={<Icon className="text-md" component={Delete} />}
            onClick={() => onDeleteBoost(termBoost.value)}
          />
          <Button
            className="save-term-boost"
            data-testid="save-term-boost"
            disabled={
              !termBoostData.field ||
              !termBoostData.value ||
              !termBoostData.boost
            }
            icon={<Icon className="text-md" component={Save} />}
            onClick={handleSave}
          />
        </Col>
      </Row>
      <Row className="p-box d-flex flex-column gap-3">
        <Col className="p-y-xs p-l-sm p-r-xss border-radius-card m-b-sm bg-white config-section-content">
          <AsyncSelect
            showSearch
            api={fetchTags}
            className="w-full custom-select"
            data-testid="term-boost-select"
            defaultValue={termBoostData.value || undefined}
            filterOption={getFilterOptions}
            optionLabelProp="value"
            placeholder={t('label.select-tag')}
            suffixIcon={<DownOutlined className="text-grey-muted" />}
            value={termBoostData.value || undefined}
            onChange={handleTagChange}
          />
        </Col>
        <Col className="d-flex flex-column gap-2">
          <div className="d-flex items-center justify-between p-x-xss">
            <Typography.Text data-testid="term-boost-impact-label">
              {t('label.boost')}
            </Typography.Text>
            <Typography.Text
              className="font-semibold boost-value"
              data-testid="term-boost-value">
              {termBoostData.boost}
            </Typography.Text>
          </div>
          <div data-testid="term-boost-slider">
            <Slider
              max={100}
              min={0}
              tooltip={{ open: false }}
              value={termBoostData.boost}
              onChange={handleBoostChange}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default TermBoostComponent;
