/*
 *  Copyright 2024 Collate.
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
import { TabsProps } from 'antd';
import { isUndefined } from 'lodash';
import React from 'react';
import EmptyWidgetPlaceholder from '../../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { SIZE } from '../../enums/common.enum';
import { GlossaryTermDetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import customizeGlossaryTermPageClassBase from '../CustomiseGlossaryTermPage/CustomizeGlossaryTermPage';
import { getEntityName } from '../EntityUtils';

export const getWidgetFromKey = ({
  widgetConfig,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  isEditView,
  iconHeight,
  iconWidth,
}: {
  widgetConfig: WidgetConfig;
  handleOpenAddWidgetModal?: () => void;
  handlePlaceholderWidgetKey?: (key: string) => void;
  handleRemoveWidget?: (key: string) => void;
  iconHeight?: SIZE;
  iconWidth?: SIZE;
  isEditView?: boolean;
}) => {
  if (
    widgetConfig.i.endsWith('.EmptyWidgetPlaceholder') &&
    !isUndefined(handleOpenAddWidgetModal) &&
    !isUndefined(handlePlaceholderWidgetKey) &&
    !isUndefined(handleRemoveWidget)
  ) {
    return (
      <EmptyWidgetPlaceholder
        handleOpenAddWidgetModal={handleOpenAddWidgetModal}
        handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
        handleRemoveWidget={handleRemoveWidget}
        iconHeight={iconHeight}
        iconWidth={iconWidth}
        isEditable={widgetConfig.isDraggable}
        widgetKey={widgetConfig.i}
      />
    );
  }

  const widgetKey = customizeGlossaryTermPageClassBase.getKeyFromWidgetName(
    widgetConfig.i
  );

  const Widget = customizeGlossaryTermPageClassBase.getWidgetsFromKey<
    typeof widgetKey
  >(widgetConfig.i as GlossaryTermDetailPageWidgetKeys);

  return (
    <Widget
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      selectedGridSize={widgetConfig.w}
      widgetKey={widgetConfig.i}
    />
  );
};

export const getGlossaryTermDetailTabs = (
  defaultTabs: TabsProps['items'],
  customizedTabs?: Tab[],
  defaultTabId: EntityTabs = EntityTabs.OVERVIEW
) => {
  if (!customizedTabs) {
    return defaultTabs;
  }
  const overviewTab = defaultTabs?.find((t) => t.key === defaultTabId);

  const newTabs =
    customizedTabs?.map((t) => {
      const tabItemDetails = defaultTabs?.find((i) => i.key === t.id);

      return (
        tabItemDetails ?? {
          label: getEntityName(t),
          key: t.id,
          children: overviewTab?.children,
        }
      );
    }) ?? defaultTabs;

  return newTabs;
};

export const getTabLabelMap = (tabs?: Tab[]): Record<EntityTabs, string> => {
  const labelMap = {} as Record<EntityTabs, string>;

  return (
    tabs?.reduce((acc: Record<EntityTabs, string>, item) => {
      if (item.id && item.displayName) {
        const tab = item.id as EntityTabs;
        acc[tab] = item.displayName;
      }

      return acc;
    }, labelMap) ?? labelMap
  );
};
