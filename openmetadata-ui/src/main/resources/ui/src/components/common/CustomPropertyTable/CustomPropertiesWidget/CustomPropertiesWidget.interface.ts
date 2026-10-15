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

/**
 * How the widget sits on the tab. Preview is a narrow list of rows next to the
 * tab content; full width spans the tab with a card per property.
 */
export type CustomPropertiesWidgetStyle = 'preview' | 'fullWidth';

export type CustomPropertyLayoutWidth = 'half' | 'full';

/** Small is a one-line row with an edit button; large is the full card. */
export type CustomPropertyCardSize = 'small' | 'large';

/** Position (array order), width and size of one property in a persona layout. */
export interface CustomPropertyLayoutItem {
  name: string;
  width: CustomPropertyLayoutWidth;
  /** Only the widget stores a size; the Custom Properties tab is always large. */
  size?: CustomPropertyCardSize;
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
  size?: CustomPropertyCardSize;
}

/** Per-instance settings of the persona Custom Properties widget. */
export interface CustomPropertiesWidgetSettings {
  displayMode: CustomPropertiesDisplayMode;
  /** Only read when displayMode is 'selected'. */
  propertyNames: string[];
  showHeader: boolean;
  /**
   * The widget's grid size, picked when it is added. It is also the card size
   * of every property the layout does not size itself.
   */
  size: CustomPropertyCardSize;
  /** Order, width and size of the shown properties; unlisted ones follow, full width. */
  propertyLayout: CustomPropertyLayoutItem[];
}
