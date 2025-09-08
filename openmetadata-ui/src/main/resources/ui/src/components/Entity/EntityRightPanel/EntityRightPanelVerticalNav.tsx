/*
 *  Copyright 2023 Collate.
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
import {
  AppstoreOutlined,
  BarChartOutlined,
  CompassOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Menu } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import './EntityRightPanelVerticalNav.less';

export enum EntityRightPanelTab {
  OVERVIEW = 'overview',
  SCHEMA = 'schema',
  LINEAGE = 'lineage',
  DATA_QUALITY = 'data-quality',
  CUSTOM_PROPERTIES = 'custom-properties',
}

interface EntityRightPanelVerticalNavProps {
  activeTab: EntityRightPanelTab;
  entityType: EntityType;
  onTabChange: (tab: EntityRightPanelTab) => void;
}

const EntityRightPanelVerticalNav: React.FC<EntityRightPanelVerticalNavProps> =
  ({ activeTab, entityType, onTabChange }) => {
    const { t } = useTranslation();

    const getTabItems = () => {
      const items = [
        {
          key: EntityRightPanelTab.OVERVIEW,
          icon: <CompassOutlined height={13} width={13} />,
          label: t('label.overview'),
        },
      ];

      // Add schema tab for entities that have schema

      items.push({
        key: EntityRightPanelTab.SCHEMA,
        icon: <BarChartOutlined height={13} width={13} />,
        label: t('label.schema'),
      });

      // Add lineage tab for most entities

      items.push({
        key: EntityRightPanelTab.LINEAGE,
        icon: <SwapOutlined height={13} width={13} />,
        label: t('label.lineage'),
      });

      // Add data quality tab for tables

      items.push({
        key: EntityRightPanelTab.DATA_QUALITY,
        icon: <SafetyCertificateOutlined height={13} width={13} />,
        label: t('label.data-quality'),
      });

      // Add custom properties tab
      items.push({
        key: EntityRightPanelTab.CUSTOM_PROPERTIES,
        icon: <AppstoreOutlined height={13} width={13} />,
        label: t('label.custom-property'),
      });

      return items;
    };

    return (
      <div className="entity-right-panel-vertical-nav">
        <Menu
          className="vertical-nav-menu"
          items={getTabItems()}
          mode="vertical"
          selectedKeys={[activeTab]}
          onClick={({ key }) => onTabChange(key as EntityRightPanelTab)}
        />
      </div>
    );
  };

export default EntityRightPanelVerticalNav;
