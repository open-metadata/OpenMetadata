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
import { ReactElement, ReactNode } from 'react';
import {
  CUSTOM_PROPERTY_HEADER_ID_PREFIX,
  HeaderPropertyId,
} from '../../../constants/EntityHeaderProperties.constants';
import { EntityType } from '../../../enums/entity.enum';
import { EntityHeader } from '../../../generated/system/ui/page';

/** A custom property's header id: `extension.<propertyName>`. */
export type CustomHeaderPropertyId =
  `${typeof CUSTOM_PROPERTY_HEADER_ID_PREFIX}${string}`;

export interface HeaderProperty {
  id: HeaderPropertyId | CustomHeaderPropertyId;
  label: string;
  isEmpty: boolean;
  /** Set by the system, so an empty one has nothing for anyone to fill in. */
  isReadOnly: boolean;
  /** The custom property's type name; unset for standard properties. */
  customPropertyType?: string;
  /** The value, drawn under the label; an empty value is drawn by the field. */
  content: ReactNode;
  /** Wraps a trigger in the property's editor; unset when the viewer cannot edit it. */
  renderEditor?: (trigger: ReactElement) => ReactNode;
  editorTestId?: string;
  testId?: string;
}

export interface EntityHeaderPropertiesProps {
  entityType: EntityType;
  properties: HeaderProperty[];
  entityHeader?: EntityHeader;
  /** The persona whose header is being customized. */
  personaName?: string;
  /**
   * Set on the persona customize page, where the header can be edited.
   * `undefined` means the page type's default header.
   */
  onEntityHeaderChange?: (entityHeader?: EntityHeader) => void;
}

export interface CustomizeEntityHeaderPanelProps {
  entityType: EntityType;
  personaName?: string;
  properties: HeaderProperty[];
  entityHeader: EntityHeader;
  onApply: (entityHeader: EntityHeader) => void;
  onClose: () => void;
}
