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
  Dropdown,
  Radio,
  Slider,
  Switch,
  Typography,
} from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowDown } from '../../../assets/svg/arrow-down-light.svg';
import { ReactComponent as Document } from '../../../assets/svg/document.svg';
import { ReactComponent as FilterIcon } from '../../../assets/svg/filter.svg';
import { MatchType } from '../../../pages/SearchSettingsPage/searchSettings.interface';
import AddBoost from '../AddBoost/AddBoost';
import './field-configuration.less';
import { FieldConfigurationProps } from './fieldConfiguration.interface';

const FieldConfiguration: React.FC<FieldConfigurationProps> = ({
  field,
  index,
  searchSettings,
  onHighlightFieldsChange,
  onMatchTypeChange,
  onFieldWeightChange,
  onBoostChange,
  onDeleteBoost,
  getSelectedMatchType,
}) => {
  const { t } = useTranslation();
  const [activeFieldKeys, setActiveFieldKeys] = useState<
    Record<number, string[]>
  >({});
  const [boostDropdownOpen, setBoostDropdownOpen] = useState(false);
  const [activeBoostField, setActiveBoostField] = useState<string | null>(null);

  const matchFields = {
    mustMatch: searchSettings?.mustMatch ?? [],
    shouldMatch: searchSettings?.shouldMatch ?? [],
    mustNotMatch: searchSettings?.mustNotMatch ?? [],
  };

  const boostMenuItems = useMemo(
    () => [
      {
        key: '1',
        label: (
          <Button
            className="d-flex items-center justify-between border-none bg-transparent"
            data-testid="value-boost-option"
            onClick={() => handleValueBoostClick(field.fieldName)}>
            <Icon className="text-xl" component={Document} />
            <Typography.Text>{t('label.value')}</Typography.Text>
          </Button>
        ),
      },
    ],
    [field.fieldName]
  );

  const handleCollapseChange = (key: string | string[], index: number) => {
    setActiveFieldKeys((prevKeys) => ({
      ...prevKeys,
      [index]: Array.isArray(key) ? key : [key],
    }));
  };

  const handleValueBoostClick = (fieldName: string) => {
    setActiveBoostField(fieldName);
    setBoostDropdownOpen(false);
  };

  const handleBoostDropdownToggle = (open: boolean) => {
    setBoostDropdownOpen(open);
    if (!open) {
      setActiveBoostField(null);
    }
  };

  const handleWeightChange = (value: number) => {
    onFieldWeightChange(field.fieldName, value);
  };

  const handleDeleteBoost = (fieldName: string) => {
    onDeleteBoost(fieldName);
    setActiveBoostField(null);
  };

  return (
    <Collapse
      activeKey={activeFieldKeys[index] || []}
      bordered={false}
      key={index}
      onChange={(key) => handleCollapseChange(key, index)}>
      <Collapse.Panel
        className="bg-white custom-panel m-b-md"
        header={
          <div
            className="field-container-header"
            data-testid="field-container-header"
            style={{
              backgroundColor: activeFieldKeys[index]?.includes(String(index))
                ? '#F5FAFF'
                : 'white',
            }}>
            <Typography.Text data-testid="field-name">
              {field.fieldName}
            </Typography.Text>
            <div className="d-flex items-center justify-between m-y-xss">
              <span className="text-grey-muted text-xs font-normal">
                {t('label.select-test-type')}
              </span>
              <span
                className="p-x-xs font-semibold text-primary d-flex items-center field-weightage"
                data-testid="field-weight">
                <Icon className="text-sm" component={FilterIcon} />
                {field.weight < 10 ? `0${field.weight}` : field.weight}
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

          {/* Match Type Section */}
          <Radio.Group
            className="d-flex flex-column gap-2"
            value={getSelectedMatchType(field.fieldName, matchFields)}
            onChange={(e) =>
              onMatchTypeChange(field.fieldName, e.target.value as MatchType)
            }>
            <Radio data-testid="must-match-radio" value="mustMatch">
              {t('label.must-match')}
            </Radio>
            <Radio data-testid="should-match-radio" value="shouldMatch">
              {t('label.should-match')}
            </Radio>
            <Radio data-testid="must-not-match-radio" value="mustNotMatch">
              {t('label.must-not-match')}
            </Radio>
          </Radio.Group>
          <Divider />

          {/* Weight Section */}
          <div className="m-y-md m-b-lg d-flex items-center justify-between">
            <Typography.Text>{t('label.weight')}</Typography.Text>
            <Typography.Text
              className="font-semibold field-weightage-text"
              data-testid="field-weight-value">
              {searchSettings?.fields?.[field.fieldName] ?? field.weight}
            </Typography.Text>
          </div>
          <div data-testid="field-weight-slider">
            <Slider
              max={10}
              min={0}
              tooltip={{ open: false }}
              value={searchSettings?.fields?.[field.fieldName] ?? field.weight}
              onChange={handleWeightChange}
            />
          </div>

          <Divider />

          {/* Boost Section */}
          <div className="m-y-md d-flex justify-end w-full">
            <Dropdown
              getPopupContainer={(triggerNode) => triggerNode.parentElement!}
              menu={{
                items: boostMenuItems,
              }}
              open={boostDropdownOpen}
              placement="bottom"
              trigger={['click']}
              onOpenChange={handleBoostDropdownToggle}>
              <Button
                className="add-boost-btn d-flex items-center justify-center gap-2"
                data-testid="add-boost">
                <span className="font-semibold text-sm">
                  {t('label.add-boost')}
                </span>
                <Icon className="text-3xl m-t-lg" component={ArrowDown} />
              </Button>
            </Dropdown>
          </div>

          {/* Add Boost Component */}
          {activeBoostField === field.fieldName && (
            <AddBoost
              boosts={searchSettings?.boosts ?? []}
              fieldName={field.fieldName}
              onBoostChange={onBoostChange}
              onDeleteBoost={handleDeleteBoost}
            />
          )}
        </div>
      </Collapse.Panel>
    </Collapse>
  );
};

export default FieldConfiguration;
