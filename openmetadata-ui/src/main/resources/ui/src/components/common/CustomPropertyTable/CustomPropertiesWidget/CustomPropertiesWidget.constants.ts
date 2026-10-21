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
import { TAB_GRID_MAX_COLUMNS } from '../../../../constants/CustomizeWidgets.constants';
import {
  CustomPropertiesDisplayMode,
  CustomPropertiesWidgetSettings,
  CustomPropertiesWidgetStyle,
  CustomPropertyCardSize,
} from './CustomPropertiesWidget.interface';

/** Number of properties the widget shows when it has not been configured. */
export const CUSTOM_PROPERTIES_WIDGET_DEFAULT_LIMIT = 5;

export const CUSTOM_PROPERTIES_WIDGET_DEFAULT_SIZE: CustomPropertyCardSize =
  'small';

export const DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS: CustomPropertiesWidgetSettings =
  {
    displayMode: 'default',
    propertyNames: [],
    showHeader: true,
    size: CUSTOM_PROPERTIES_WIDGET_DEFAULT_SIZE,
    propertyLayout: [],
  };

export const CUSTOM_PROPERTIES_DISPLAY_MODES: CustomPropertiesDisplayMode[] = [
  'default',
  'all',
  'selected',
];

/** Max height in px of the widget list; taller lists scroll inside it. */
export const CUSTOM_PROPERTIES_WIDGET_MAX_HEIGHT = 400;

export const CUSTOM_PROPERTIES_WIDGET_STYLES: CustomPropertiesWidgetStyle[] = [
  'preview',
  'fullWidth',
];

/**
 * Grid columns the widget spans for each style. Preview matches the side
 * widgets of the default layouts; full width spans the whole tab.
 */
export const CUSTOM_PROPERTIES_WIDGET_GRID_WIDTH: Record<
  CustomPropertiesWidgetStyle,
  number
> = {
  preview: 2,
  fullWidth: TAB_GRID_MAX_COLUMNS,
};

export const CUSTOM_PROPERTIES_WIDGET_STYLE_LABEL: Record<
  CustomPropertiesWidgetStyle,
  string
> = {
  preview: 'label.preview',
  fullWidth: 'label.full-width',
};
