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
import { Tabs } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CustomPropertiesIcon } from '../../../assets/svg/explore-vertical-nav-icons/custom-prop.svg';
import { ReactComponent as ExploreIcon } from '../../../assets/svg/explore-vertical-nav-icons/explore.svg';
import { ReactComponent as PlatformLineageIcon } from '../../../assets/svg/explore-vertical-nav-icons/ic-platform-lineage.svg';
import { ReactComponent as SchemaIcon } from '../../../assets/svg/explore-vertical-nav-icons/ic-schema.svg';
import { ReactComponent as DataQualityIcon } from '../../../assets/svg/ic-data-contract.svg';
import { ReactComponent as RelationsNavIcon } from '../../../assets/svg/ic_relations.svg';
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
          icon: <ExploreIcon />,
          label: t('label.overview'),
          'data-testid': 'overview-tab',
        },
        {
          key: EntityRightPanelTab.RELATIONS,
          icon: (
            <RelationsNavIcon className="tw:h-[18px] tw:w-[18px] tw:shrink-0 tw:text-quaternary" />
          ),
          label: t('label.relation-plural'),
          'data-testid': 'ontology-relations-tab',
        },
      ];
    }

    const items = [
      {
        key: EntityRightPanelTab.OVERVIEW,
        icon: <ExploreIcon />,
        label: t('label.overview'),
        'data-testid': 'overview-tab',
      },
    ];

    // Add schema tab for entities that have schema
    if (hasSchemaTab(entityType) && !isColumnDetailPanel) {
      items.push({
        key: EntityRightPanelTab.SCHEMA,
        icon: <SchemaIcon />,
        label: t('label.schema'),
        'data-testid': 'schema-tab',
      });
    }
    // Add lineage tab for most entities
    if (hasLineageTab(entityType) && !isColumnDetailPanel) {
      items.push({
        key: EntityRightPanelTab.LINEAGE,
        icon: <PlatformLineageIcon />,
        label: t('label.lineage'),
        'data-testid': 'lineage-tab',
      });
    }

    // Add data quality tab for tables
    if (entityType === EntityType.TABLE) {
      items.push({
        key: EntityRightPanelTab.DATA_QUALITY,
        icon: <DataQualityIcon />,
        label: t('label.data-quality'),
        'data-testid': 'data-quality-tab',
      });
    }

    // Add custom properties tab
    if (shouldShowCustomPropertiesTab(entityType, isColumnDetailPanel)) {
      items.push({
        key: EntityRightPanelTab.CUSTOM_PROPERTIES,
        icon: <CustomPropertiesIcon />,
        label: t('label.custom-property'),
        'data-testid': 'custom-properties-tab',
      });
    }

    if (appendOntologyRelationsTab) {
      items.push({
        key: EntityRightPanelTab.RELATIONS,
        icon: <RelationsNavIcon />,
        label: t('label.relation-plural'),
        'data-testid': 'ontology-relations-tab',
      });
    }

    return items;
  };

  return (
    <div
      className={classNames(
        'entity-right-panel-vertical-nav tw:relative tw:right-0.5 tw:flex tw:w-20 tw:flex-col tw:items-center tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:bg-surface',
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
          className="tw:w-full tw:gap-5 tw:pt-5">
          {getTabItems().map(({ key, icon, label, 'data-testid': testId }) => (
            <Tabs.Item
              className={({ isSelected }) =>
                classNames(
                  'tw:relative tw:h-auto tw:w-full tw:flex-col tw:justify-center tw:gap-1.5 tw:rounded-none tw:bg-transparent tw:p-0 tw:font-normal tw:whitespace-normal tw:shadow-none',
                  'tw:text-utility-gray-600 tw:hover:bg-transparent tw:hover:text-utility-brand-700 tw:[&>svg]:size-6 tw:[&>svg]:transition-all tw:[&>svg]:duration-200',
                  isSelected && [
                    'tw:bg-brand-primary tw:text-utility-brand-600 tw:hover:bg-brand-primary tw:hover:text-utility-brand-600',
                    'tw:before:absolute tw:before:top-1/2 tw:before:left-0 tw:before:h-8 tw:before:w-1',
                    'tw:before:-translate-y-1/2 tw:before:rounded-r-sm tw:before:bg-utility-brand-600',
                  ]
                )
              }
              data-testid={testId}
              id={key}
              key={key}>
              {({ isSelected }) => (
                <>
                  {icon}
                  <span
                    className={classNames(
                      'tw:mx-auto tw:block tw:w-[54px] tw:text-center tw:text-[11px] tw:leading-[1.2] tw:break-words tw:whitespace-normal',
                      isSelected ? 'tw:font-semibold' : 'tw:font-normal'
                    )}>
                    {label}
                  </span>
                </>
              )}
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
  );
};

export default EntityRightPanelVerticalNav;
