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
import {
  Button,
  Collapse,
  Divider,
  Select,
  Slider,
  Switch,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-colored.svg';
import { ReactComponent as FilterIcon } from '../../../assets/svg/setting-colored.svg';
import { MatchType } from '../../../generated/settings/settings';
import './field-configuration.less';
import { FieldConfigurationProps } from './fieldConfiguration.interface';

const FieldConfiguration: React.FC<FieldConfigurationProps> = ({
  field,
  index,
  searchSettings,
  entityFields,
  initialOpen,
  onHighlightFieldsChange,
  onFieldWeightChange,
  onMatchTypeChange,
  onDeleteSearchField,
}) => {
  const { t } = useTranslation();
  const [activeFieldKeys, setActiveFieldKeys] = useState<
    Record<number, string[]>
  >({});
  const [fieldWeight, setFieldWeight] = useState(field.weight);
  const [fieldMatchType, setFieldMatchType] = useState(
    field.matchType || MatchType.Standard
  );

  const fieldDescription = entityFields.find(
    (entityField) => entityField.name === field.fieldName
  )?.description;

  useEffect(() => {
    // If initialOpen is true, open this panel automatically
    if (initialOpen) {
      setActiveFieldKeys((prevKeys) => ({
        ...prevKeys,
        [index]: [String(index)],
      }));
    }
  }, [initialOpen, index]);

  const handleCollapseChange = (key: string | string[], index: number) => {
    setActiveFieldKeys((prevKeys) => ({
      ...prevKeys,
      [index]: Array.isArray(key) ? key : [key],
    }));
  };

  const handleWeightChange = (value: number) => {
    setFieldWeight(value);
    onFieldWeightChange(field.fieldName, value);
  };

  const handleMatchTypeChange = (value: MatchType) => {
    setFieldMatchType(value);
    onMatchTypeChange(field.fieldName, value);
  };

  const matchTypeOptions = [
    { label: t('label.exact-match'), value: MatchType.Exact },
    { label: t('label.phrase-match'), value: MatchType.Phrase },
    { label: t('label.fuzzy-match'), value: MatchType.Fuzzy },
    { label: t('label.standard-match'), value: MatchType.Standard },
  ];

  return (
    <Collapse
      activeKey={activeFieldKeys[index] || []}
      bordered={false}
      data-field-name={field.fieldName}
      key={index}
      onChange={(key) => handleCollapseChange(key, index)}>
      <Collapse.Panel
        className=" custom-panel m-b-md"
        data-testid={`field-configuration-panel-${field.fieldName}`}
        header={
          <div
            className="field-container-header"
            data-testid="field-container-header"
            style={{
              backgroundColor: activeFieldKeys[index]?.includes(String(index))
                ? '#F5FAFF'
                : 'white',
            }}>
            <div className="d-flex items-center justify-between">
              <Typography.Text data-testid="field-name">
                {field.fieldName}
              </Typography.Text>
              <Button
                className="delete-search-field"
                data-testid="delete-search-field"
                icon={<Icon className="text-md" component={Delete} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSearchField(field.fieldName);
                }}
              />
            </div>

            <div className="d-flex items-center justify-between gap-2 m-y-xss">
              <span className="text-grey-muted text-xs font-normal">
                {fieldDescription ?? t('label.no-description')}
              </span>
              <span
                className="p-x-xs font-semibold text-primary d-flex items-center field-weightage"
                data-testid="field-weight">
                <Icon className="text-md" component={FilterIcon} />
                {fieldWeight < 10 ? `0${fieldWeight}` : fieldWeight}
              </span>
            </div>
          </div>
        }
        key={String(index)}
        showArrow={false}>
        <Divider className="m-0" />
        <div className="m-y-sm" style={{ padding: '10px' }}>
          {/* Highlight Fields Section */}
          <div className="m-y-md m-b-lg d-flex items-center justify-between">
            <Typography.Text>
              {t('label.highlight-field-plural')}
            </Typography.Text>
            <Switch
              checked={
                searchSettings?.highlightFields?.includes(field.fieldName) ??
                false
              }
              className="m-l-xlg"
              data-testid="highlight-field-switch"
              onChange={() => onHighlightFieldsChange(field.fieldName)}
            />
          </div>
          <Divider />

          {/* Weight Section */}
          <div className="m-y-md m-b-lg d-flex items-center justify-between">
            <Typography.Text>{t('label.weight')}</Typography.Text>
            <Typography.Text
              className="font-semibold field-weightage-text"
              data-testid="field-weight-value">
              {fieldWeight}
            </Typography.Text>
          </div>
          <div data-testid="field-weight-slider">
            <Slider
              max={100}
              min={0}
              tooltip={{ open: false }}
              value={fieldWeight}
              onChange={handleWeightChange}
            />
          </div>
          <Divider />

          {/* Match Type Section */}
          <div className="m-y-md m-b-lg d-flex items-center justify-between">
            <Typography.Text>{t('label.match-type')}</Typography.Text>
            <Select
              className="m-l-xlg"
              data-testid="match-type-select"
              options={matchTypeOptions}
              style={{ width: 150 }}
              value={fieldMatchType}
              onChange={handleMatchTypeChange}
            />
          </div>
        </div>
      </Collapse.Panel>
    </Collapse>
  );
};

export default FieldConfiguration;
