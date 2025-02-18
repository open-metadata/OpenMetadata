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
import { isUndefined } from 'lodash';
import React from 'react';
import EmptyWidgetPlaceholder from '../../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { SIZE } from '../../enums/common.enum';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import customizeGlossaryTermPageClassBase from '../CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';

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

  const Widget = customizeGlossaryTermPageClassBase.getWidgetsFromKey(
    widgetConfig.i
  );

  return (
    <Widget
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      selectedGridSize={widgetConfig.w}
      widgetKey={widgetConfig.i}
    />
  );
};
