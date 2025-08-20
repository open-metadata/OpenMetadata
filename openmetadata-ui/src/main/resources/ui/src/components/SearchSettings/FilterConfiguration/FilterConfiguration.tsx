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
  Checkbox,
  Col,
  Divider,
  Dropdown,
  Row,
  Typography,
} from 'antd';
import { startCase } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '../../../assets/svg/close.svg?react';
import FilterIcon from '../../../assets/svg/filter-primary.svg?react';
import { DATA_ASSET_DROPDOWN_ITEMS } from '../../../constants/AdvancedSearch.constants';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import './filter-configuration.less';

const FilterConfiguration = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const entityFields = useMemo(
    () =>
      Object.entries(EntityFields).map(([key, field]) => ({
        fieldName: field,
        label: startCase(key.toLowerCase()),
      })),
    []
  );

  const menuItems = useMemo(
    () => ({
      items: entityFields.map((field) => ({
        key: field.fieldName,
        label: (
          <Checkbox
            checked={checkedItems.includes(field.fieldName)}
            onChange={() => handleCheckboxChange(field.fieldName)}>
            {field.label}
          </Checkbox>
        ),
      })),
      className: 'menu-items',
    }),
    [entityFields, checkedItems]
  );

  const handleCheckboxChange = (fieldName: string) => {
    setCheckedItems((prev) =>
      prev.includes(fieldName)
        ? prev.filter((item) => item !== fieldName)
        : [...prev, fieldName]
    );
  };

  return (
    <Row className="filters-configuration-row p-y-md p-x-lg" gutter={[0, 16]}>
      <Col span={24}>
        <Typography.Title className="text-md font-semibold" level={5}>
          {t('label.filters-configuration')}
        </Typography.Title>
      </Col>
      <Col className="filter-configuration-container" span={24}>
        <Dropdown
          data-testid="add-filter-dropdown"
          getPopupContainer={(triggerNode) => triggerNode.parentElement!}
          menu={menuItems}
          open={visible}
          placement="bottomLeft"
          trigger={['click']}
          onOpenChange={(flag) => setVisible(flag)}>
          <Button
            className="flex items-center gap-2 p-md text-sm font-medium add-filters-btn"
            icon={<FilterIcon />}>
            {t('label.add-filter-plural')}
          </Button>
        </Dropdown>
        <Divider className="h-auto self-stretch" type="vertical" />
        {DATA_ASSET_DROPDOWN_ITEMS.map((value) => (
          <div
            className="bg-white flex items-center justify-center gap-3 p-y-xss p-x-sm filter-value"
            key={value.key}>
            {value.label}
            <Icon
              className="text-grey-muted text-xss cursor-pointer"
              component={CloseIcon}
            />
          </div>
        ))}
      </Col>
    </Row>
  );
};

export default FilterConfiguration;
