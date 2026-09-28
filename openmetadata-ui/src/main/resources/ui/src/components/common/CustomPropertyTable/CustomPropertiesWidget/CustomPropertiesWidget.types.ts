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

export type CustomPropertiesDisplayMode = 'default' | 'all' | 'selected';

export type CustomPropertyLayoutWidth = 'half' | 'full';

/** Position (array order) and width of one property in a persona layout. */
export interface CustomPropertyLayoutItem {
  name: string;
  width: CustomPropertyLayoutWidth;
}

/** Where a dragged layout tile lands: before or after the tile at `index`. */
export interface LayoutDropTarget {
  index: number;
  side: 'before' | 'after';
}

/** A property resolved against a layout, ready to render. */
export interface LaidOutCustomProperty {
  property: CustomProperty;
  width: CustomPropertyLayoutWidth;
}

/** Per-instance settings of the persona Custom Properties widget. */
export interface CustomPropertiesWidgetSettings {
  displayMode: CustomPropertiesDisplayMode;
  /** Only read when displayMode is 'selected'. */
  propertyNames: string[];
  showHeader: boolean;
  /** Order and width of the shown properties; unlisted ones follow, full width. */
  propertyLayout: CustomPropertyLayoutItem[];
}
