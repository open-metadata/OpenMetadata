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
import { CustomProperty } from '../../../../generated/type/customProperty';
import { CustomPropertiesWidgetSettings } from './CustomPropertiesWidget.interface';

export interface CustomPropertiesRightPanelProps {
  properties: CustomProperty[];
  extension?: Record<string, unknown>;
  widgetSettings?: CustomPropertiesWidgetSettings;
  /** Link to the Custom Properties tab, set when the widget hides properties. */
  viewAllPath?: string;
  hasEditPermissions: boolean;
  /**
   * Renders a version page: every property as a read-only row whose value
   * carries the version diff, since the cards cannot show one.
   */
  isVersionView?: boolean;
  /** Properties that first got a value in the version. */
  addedKeys?: string[];
  onValueSave: (property: CustomProperty, value: unknown) => Promise<void>;
}
