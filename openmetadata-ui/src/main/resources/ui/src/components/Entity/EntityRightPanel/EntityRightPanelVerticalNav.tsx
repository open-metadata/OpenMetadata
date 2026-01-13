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
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CustomPropertiesIcon } from '../../../assets/svg/explore-vertical-nav-icons/custom-prop.svg';
import { ReactComponent as ExploreIcon } from '../../../assets/svg/explore-vertical-nav-icons/explore.svg';
import { ReactComponent as PlatformLineageIcon } from '../../../assets/svg/explore-vertical-nav-icons/ic-platform-lineage.svg';
import { ReactComponent as SchemaIcon } from '../../../assets/svg/explore-vertical-nav-icons/ic-schema.svg';
import { ReactComponent as DataQualityIcon } from '../../../assets/svg/ic-data-contract.svg';
import { EntityType } from '../../../enums/entity.enum';
import {
  hasCustomPropertiesTab,
  hasLineageTab,
  hasSchemaTab,
} from '../../../utils/EntityUtils';
import {
  EntityRightPanelTab,
  EntityRightPanelVerticalNavProps,
} from './EntityRightPanelVerticalNav.interface';
import './EntityRightPanelVerticalNav.less';

const EntityRightPanelVerticalNav: React.FC<EntityRightPanelVerticalNavProps> =
  ({
    activeTab,
    entityType,
    onTabChange,
    verticalNavConatinerclassName,
    isSideDrawer = false,
    isColumnDetailPanel = false,
  }) => {
    const { t } = useTranslation();

    const getTabItems = () => {
      const items = [
        {
          key: EntityRightPanelTab.OVERVIEW,
          icon: <ExploreIcon height={16} width={16} />,
          label: t('label.overview'),
          'data-testid': 'overview-tab',
        },
      ];

      // Add schema tab for entities that have schema
      if (hasSchemaTab(entityType) && !isColumnDetailPanel) {
        items.push({
          key: EntityRightPanelTab.SCHEMA,
          icon: <SchemaIcon height={16} width={16} />,
          label: t('label.schema'),
          'data-testid': 'schema-tab',
        });
      }
      // Add lineage tab for most entities
      if (hasLineageTab(entityType) && !isColumnDetailPanel) {
        items.push({
          key: EntityRightPanelTab.LINEAGE,
          icon: <PlatformLineageIcon height={16} width={16} />,
          label: t('label.lineage'),
          'data-testid': 'lineage-tab',
        });
      }

      // Add data quality tab for tables
      if (entityType === EntityType.TABLE) {
        items.push({
          key: EntityRightPanelTab.DATA_QUALITY,
          icon: <DataQualityIcon height={16} width={16} />,
          label: t('label.data-quality'),
          'data-testid': 'data-quality-tab',
        });
      }

      // Add custom properties tab
      if (hasCustomPropertiesTab(entityType)) {
        items.push({
          key: EntityRightPanelTab.CUSTOM_PROPERTIES,
          icon: <CustomPropertiesIcon height={16} width={16} />,
          label: t('label.custom-property'),
          'data-testid': 'custom-properties-tab',
        });
      }

      return items;
    };

    return (
      <div
        className={classNames(
          'entity-right-panel-vertical-nav',
          verticalNavConatinerclassName,
          { 'drawer-entity-right-panel-vertical-nav': isSideDrawer }
        )}>
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
