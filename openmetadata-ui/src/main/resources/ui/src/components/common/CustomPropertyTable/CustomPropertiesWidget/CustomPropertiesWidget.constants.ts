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
import {
  CustomPropertiesDisplayMode,
  CustomPropertiesWidgetSettings,
} from './CustomPropertiesWidget.types';

/** Number of properties the widget shows when it has not been configured. */
export const CUSTOM_PROPERTIES_WIDGET_DEFAULT_LIMIT = 5;

export const DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS: CustomPropertiesWidgetSettings =
  {
    displayMode: 'default',
    propertyNames: [],
    showHeader: true,
    propertyLayout: [],
  };

export const CUSTOM_PROPERTIES_DISPLAY_MODES: CustomPropertiesDisplayMode[] = [
  'default',
  'all',
  'selected',
];

/** Max height in px of the widget list; taller lists scroll inside it. */
export const CUSTOM_PROPERTIES_WIDGET_MAX_HEIGHT = 400;
