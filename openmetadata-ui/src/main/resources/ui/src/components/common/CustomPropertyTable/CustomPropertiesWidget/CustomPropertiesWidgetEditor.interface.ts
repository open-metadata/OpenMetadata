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
  CustomPropertiesWidgetSettings,
  LaidOutCustomProperty,
  LayoutDropTarget,
} from './CustomPropertiesWidget.interface';

export interface EditorRowProps {
  item: LaidOutCustomProperty;
  index: number;
  dropSide?: LayoutDropTarget['side'];
  onHover: (fromIndex: number, target: LayoutDropTarget) => void;
  onDragEnd: () => void;
}

export interface PreviewRowListProps {
  items: LaidOutCustomProperty[];
  onChange: (items: LaidOutCustomProperty[]) => void;
}

export interface CustomPropertiesWidgetEditorProps {
  entityType?: string;
  settings: CustomPropertiesWidgetSettings;
  onChange: (settings: CustomPropertiesWidgetSettings) => void;
}

export interface CustomPropertiesWidgetHeaderInfoProps {
  entityType?: string;
  settings: CustomPropertiesWidgetSettings;
}
