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
import { Button, Typography } from 'antd';
import { Dropdown } from '../AntdCompat';;
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PlusOutlined } from '../../../assets/svg/plus-outlined.svg';
import './collapse-header.less';

interface CollapseHeaderProps {
  title: string;
  menuItems?: ItemType[];
  handleAddNewBoost?: () => void;
  dataTestId?: string;
}

const CollapseHeader = ({
  title,
  menuItems,
  dataTestId,
  handleAddNewBoost,
}: CollapseHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="d-flex items-center justify-between">
      <Typography.Text className="text-md font-semibold">
        {title}
      </Typography.Text>
      {menuItems ? (
        <Dropdown
          getPopupContainer={(triggerNode) => triggerNode.parentElement!}
          menu={{
            items: menuItems,
            className: 'menu-items',
          }}
          placement="bottomLeft"
          trigger={['click']}>
          <Button
            className="add-field-btn"
            data-testid={dataTestId}
            icon={<Icon className="text-xs" component={PlusOutlined} />}
            type="primary"
            onClick={(e) => e.stopPropagation()}>
            {t('label.add')}
          </Button>
        </Dropdown>
      ) : (
        <Button
          className="add-field-btn"
          data-testid={dataTestId}
          icon={<Icon className="text-xs" component={PlusOutlined} />}
          type="primary"
          onClick={(e) => {
            e.stopPropagation();
            handleAddNewBoost?.();
          }}>
          {t('label.add')}
        </Button>
      )}
    </div>
  );
};

export default CollapseHeader;
