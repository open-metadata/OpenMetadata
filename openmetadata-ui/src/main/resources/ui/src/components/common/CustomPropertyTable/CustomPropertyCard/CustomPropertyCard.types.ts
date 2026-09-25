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
import { BadgeColors } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { FC } from 'react';
import { CustomProperty } from '../../../../generated/type/customProperty';

export interface PropertyViewProps {
  property: CustomProperty;
  value: unknown;
}

/**
 * Editors render only a `<form id={formId}>`; the edit modal owns the footer,
 * whose Save button submits that form.
 */
export interface PropertyEditProps {
  formId: string;
  property: CustomProperty;
  value: unknown;
  isSaving: boolean;
  onSave: (value: unknown) => void;
}

export interface CustomPropertyRenderer {
  View: FC<PropertyViewProps>;
  Edit: FC<PropertyEditProps>;
  /** Rendered next to the card title, e.g. a time interval's status. */
  TitleAddon?: FC<PropertyViewProps>;
  /** Example value shown under "No value yet". */
  getEmptyHint?: (property: CustomProperty, t: TFunction) => string;
}

export type CustomPropertyTypeColor = Extract<
  BadgeColors,
  | 'gray'
  | 'brand'
  | 'error'
  | 'warning'
  | 'success'
  | 'gray-blue'
  | 'blue-light'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'orange'
>;

export interface CustomPropertyTypeMeta {
  icon: FC<{ className?: string }>;
  color: CustomPropertyTypeColor;
  labelKey: string;
  emptyActionKey: string;
  isWide?: boolean;
}

export type CustomPropertySortMode = 'name' | 'type' | 'value';

export interface CustomPropertyCardProps {
  property: CustomProperty;
  value: unknown;
  hasEditPermissions: boolean;
  onValueSave: (property: CustomProperty, value: unknown) => Promise<void>;
}

export interface CustomPropertyCardListProps {
  properties: CustomProperty[];
  extension?: Record<string, unknown>;
  hasEditPermissions: boolean;
  onValueSave: (property: CustomProperty, value: unknown) => Promise<void>;
}
