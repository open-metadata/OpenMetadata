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

import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { MenuInfo } from 'rc-menu/lib/interface';
import { ReactNode } from 'react';
import { getVisiblePopupContainer } from '../../../../../utils/CommonUtils';
import './widget-more-options.less';

export interface MoreOption {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface WidgetMoreOptionsProps {
  menuItems: MoreOption[];
  onMenuClick: (e: MenuInfo) => void;
  className?: string;
  dataTestId?: string;
}

const WidgetMoreOptions = ({
  menuItems,
  onMenuClick,
  className = '',
  dataTestId = 'widget-more-options',
}: WidgetMoreOptionsProps) => {
  return (
    <div className="widget-more-options-container">
      <Dropdown
        destroyPopupOnHide
        className={`widget-more-options ${className}`}
        data-testid={dataTestId}
        getPopupContainer={getVisiblePopupContainer}
        menu={{
          items: menuItems,
          selectable: false,
          onClick: onMenuClick,
          className: 'widget-more-options-menu',
        }}
        placement="bottomLeft"
        trigger={['click']}>
        <Button
          className="widget-more-options-button"
          data-testid="more-options-button"
          icon={<MoreOutlined size={20} />}
        />
      </Dropdown>
    </div>
  );
};

export default WidgetMoreOptions;
