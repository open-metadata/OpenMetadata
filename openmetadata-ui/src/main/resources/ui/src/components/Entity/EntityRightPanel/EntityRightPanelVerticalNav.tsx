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
import { Menu } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CustomPropertiesIcon } from '../../../assets/svg/explore-vertical-nav-icons/custom-prop.svg';
import { ReactComponent as ExploreIcon } from '../../../assets/svg/explore-vertical-nav-icons/explore.svg';
import { ReactComponent as PlatformLineageIcon } from '../../../assets/svg/explore-vertical-nav-icons/ic-platform-lineage.svg';
import { ReactComponent as SchemaIcon } from '../../../assets/svg/explore-vertical-nav-icons/ic-schema.svg';
import { ReactComponent as DataQualityIcon } from '../../../assets/svg/ic-data-contract.svg';
import { EntityType } from '../../../enums/entity.enum';
import {
  ENTITY_RIGHT_PANEL_LINEAGE_TABS,
  ENTITY_RIGHT_PANEL_SCHEMA_TABS,
} from './EntityRightPanelVerticalNav.constants';
import {
  EntityRightPanelTab,
  EntityRightPanelVerticalNavProps,
} from './EntityRightPanelVerticalNav.interface';
import './EntityRightPanelVerticalNav.less';

const EntityRightPanelVerticalNav: React.FC<EntityRightPanelVerticalNavProps> =
  ({ activeTab, entityType, onTabChange }) => {
    const { t } = useTranslation();

    const getTabItems = () => {
      const items = [
        {
          key: EntityRightPanelTab.OVERVIEW,
          icon: <ExploreIcon height={16} width={16} />,
          label: t('label.overview'),
        },
      ];

      // Add schema tab for entities that have schema
      if (ENTITY_RIGHT_PANEL_SCHEMA_TABS.includes(entityType)) {
        items.push({
          key: EntityRightPanelTab.SCHEMA,
          icon: <SchemaIcon height={16} width={16} />,
          label: t('label.schema'),
        });
      }
      // Add lineage tab for most entities
      if (ENTITY_RIGHT_PANEL_LINEAGE_TABS.includes(entityType)) {
        items.push({
          key: EntityRightPanelTab.LINEAGE,
          icon: <PlatformLineageIcon height={16} width={16} />,
          label: t('label.lineage'),
        });
      }

      // Add data quality tab for tables
      if (entityType === EntityType.TABLE) {
        items.push({
          key: EntityRightPanelTab.DATA_QUALITY,
          icon: <DataQualityIcon height={16} width={16} />,
          label: t('label.data-quality'),
        });
      }

      // Add custom properties tab
      items.push({
        key: EntityRightPanelTab.CUSTOM_PROPERTIES,
        icon: <CustomPropertiesIcon height={16} width={16} />,
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
