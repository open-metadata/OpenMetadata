/*
 *  Copyright 2026 Collate.
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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityTypeCustomProperties } from '../../../../hooks/useEntityTypeCustomProperties';
import {
  CUSTOM_PROPERTIES_WIDGET_GRID_WIDTH,
  DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS,
} from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.constants';
import { CustomPropertiesWidgetStyle } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.interface';
import {
  getWidgetSummary,
  isCustomPropertiesWidgetSettingsValid,
} from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.utils';
import { CustomPropertiesWidgetSettingsForm } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidgetSettingsForm';
import { AddCustomPropertiesWidgetTabContentProps } from './AddCustomPropertiesWidgetTabContent.interface';
import { AddWidgetPanel } from './AddWidgetPanel';

export const AddCustomPropertiesWidgetTabContent = ({
  entityType,
  maxGridSizeSupport,
  widget,
  onAdd,
  onCancel,
}: AddCustomPropertiesWidgetTabContentProps) => {
  const { t } = useTranslation();
  const { customProperties } = useEntityTypeCustomProperties(entityType);
  const [style, setStyle] = useState<CustomPropertiesWidgetStyle>();
  const [settings, setSettings] = useState(
    DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS
  );
  const widgetSize = style && CUSTOM_PROPERTIES_WIDGET_GRID_WIDTH[style];
  const canAdd =
    widgetSize !== undefined &&
    widgetSize <= maxGridSizeSupport &&
    isCustomPropertiesWidgetSettingsValid(settings);

  return (
    <AddWidgetPanel
      canAdd={canAdd}
      summary={style && getWidgetSummary(customProperties, settings, style, t)}
      onAdd={() => widgetSize && onAdd(widget, widgetSize, settings)}
      onCancel={onCancel}>
      <CustomPropertiesWidgetSettingsForm
        entityType={entityType}
        style={style}
        value={settings}
        onChange={setSettings}
        onStyleChange={setStyle}
      />
    </AddWidgetPanel>
  );
};
