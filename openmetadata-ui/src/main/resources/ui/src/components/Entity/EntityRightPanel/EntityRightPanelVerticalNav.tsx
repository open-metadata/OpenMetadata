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
import { Tabs, Typography } from '@openmetadata/ui-core-components';
import {
  Compass03,
  CustomProperty,
  DataContract,
  PlatformLineage,
  Relations,
  Schema02,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  hasCustomPropertiesTab,
  hasLineageTab,
  hasSchemaTab,
} from '../../../utils/EntityPermissionUtils';
import {
  EntityRightPanelTab,
  EntityRightPanelVerticalNavProps,
} from './EntityRightPanelVerticalNav.interface';

const shouldShowCustomPropertiesTab = (
  entityType: EntityType,
  isColumnDetailPanel: boolean
) =>
  (!isColumnDetailPanel && hasCustomPropertiesTab(entityType)) ||
  (isColumnDetailPanel && entityType === EntityType.TABLE);

const EntityRightPanelVerticalNav: React.FC<
  EntityRightPanelVerticalNavProps
> = ({
  activeTab,
  entityType,
  onTabChange,
  verticalNavConatinerclassName,
  isSideDrawer = false,
  isColumnDetailPanel = false,
  ontologyExplorerNav = false,
  appendOntologyRelationsTab = false,
}) => {
  const { t } = useTranslation();

  const getTabItems = () => {
    if (ontologyExplorerNav) {
      return [
        {
          key: EntityRightPanelTab.OVERVIEW,
          icon: <Compass03 />,
          label: t('label.overview'),
          'data-testid': 'overview-tab',
        },
        {
          key: EntityRightPanelTab.RELATIONS,
          icon: (
            <Relations
              className="tw:shrink-0 tw:text-utility-gray-500"
              size={18}
            />
          ),
          label: t('label.relation-plural'),
          'data-testid': 'ontology-relations-tab',
        },
      ];
    }

    const items = [
      {
        key: EntityRightPanelTab.OVERVIEW,
        icon: <Compass03 />,
        label: t('label.overview'),
        'data-testid': 'overview-tab',
      },
    ];

    // Add schema tab for entities that have schema
    if (hasSchemaTab(entityType) && !isColumnDetailPanel) {
      items.push({
        key: EntityRightPanelTab.SCHEMA,
        icon: <Schema02 />,
        label: t('label.schema'),
        'data-testid': 'schema-tab',
      });
    }
    // Add lineage tab for most entities
    if (hasLineageTab(entityType) && !isColumnDetailPanel) {
      items.push({
        key: EntityRightPanelTab.LINEAGE,
        icon: <PlatformLineage />,
        label: t('label.lineage'),
        'data-testid': 'lineage-tab',
      });
    }

    // Add data quality tab for tables
    if (entityType === EntityType.TABLE) {
      items.push({
        key: EntityRightPanelTab.DATA_QUALITY,
        icon: <DataContract />,
        label: t('label.data-quality'),
        'data-testid': 'data-quality-tab',
      });
    }

    // Add custom properties tab
    if (shouldShowCustomPropertiesTab(entityType, isColumnDetailPanel)) {
      items.push({
        key: EntityRightPanelTab.CUSTOM_PROPERTIES,
        icon: <CustomProperty />,
        label: t('label.custom-property-plural'),
        'data-testid': 'custom-properties-tab',
      });
    }

    if (appendOntologyRelationsTab) {
      items.push({
        key: EntityRightPanelTab.RELATIONS,
        icon: <Relations className="tw:text-utility-gray-500" />,
        label: t('label.relation-plural'),
        'data-testid': 'ontology-relations-tab',
      });
    }

    return items;
  };

  return (
    <div
      className={classNames(
        'entity-right-panel-vertical-nav tw:flex tw:w-20 tw:flex-col tw:items-center tw:rounded-lg tw:border tw:border-secondary tw:bg-surface',
        verticalNavConatinerclassName,
        isSideDrawer
          ? 'tw:mr-2 tw:h-screen tw:max-h-[calc(100vh-70px)]'
          : 'tw:h-full'
      )}>
      <Tabs
        className="tw:w-full"
        orientation="vertical"
        selectedKey={activeTab}
        onSelectionChange={(key) => onTabChange(key as EntityRightPanelTab)}>
        {/* pt-5 keeps the first item where antd's menu clearfix put it. */}
        <Tabs.List
          aria-label={t('label.navigation')}
          className="tw:w-full tw:gap-5 tw:pt-5"
          type="line">
          {getTabItems().map(({ key, icon, label, 'data-testid': testId }) => (
            <Tabs.Item
              className="tw:w-full tw:flex-col tw:justify-center tw:gap-1.5 tw:whitespace-normal tw:[&>svg]:size-6"
              data-testid={testId}
              id={key}
              key={key}>
              {icon}
              <Typography className="tw:w-[54px] tw:text-center tw:text-[10px] tw:leading-[1.2] tw:break-words">
                {label}
              </Typography>
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
  );
};

export default EntityRightPanelVerticalNav;
