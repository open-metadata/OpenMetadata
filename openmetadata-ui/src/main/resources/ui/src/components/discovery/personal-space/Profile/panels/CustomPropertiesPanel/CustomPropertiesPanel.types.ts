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

import { UseFormReturn } from 'react-hook-form';
import { Type } from '../../../../../../generated/entity/type';
import { CustomProperty } from '../../../../../../generated/type/customProperty';

export type CustomPropertiesSubView =
  | { type: 'landing' }
  | { type: 'detail'; entityType: Type }
  | { type: 'add'; entityType: Type }
  | { type: 'edit'; entityType: Type; property: CustomProperty };

/** FieldTypes.SELECT / MULTI_SELECT from core-components stores FormSelectItem objects, not raw strings. */
export interface FormSelectItem {
  id: string;
  label?: string;
}

export interface AddCustomPropertyFormValues {
  name: string;
  displayName?: string;
  propertyType: FormSelectItem | null;
  description: string;
  enumConfig?: FormSelectItem[];
  multiSelect?: boolean;
  formatConfig?: FormSelectItem | null;
  entityReferenceConfig?: FormSelectItem[];
  columns?: FormSelectItem[];
}

export interface EditCustomPropertyFormValues {
  displayName?: string;
  description: string;
  enumConfig?: FormSelectItem[];
  multiSelect?: boolean;
  entityReferenceConfig?: FormSelectItem[];
}

export interface DescriptionFormFieldProps<T extends { description: string }> {
  form: UseFormReturn<T>;
  descriptionKey: number;
  initialValue?: string;
}

export interface CustomPropertiesAddPageProps {
  entityType: Type;
  showHint?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export interface CustomPropertiesEditPageProps {
  entityType: Type;
  property: CustomProperty;
  showHint?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export interface CustomPropertiesDetailPageProps {
  entityType: Type;
  onAddProperty: () => void;
  onEditProperty: (property: CustomProperty) => void;
}

export interface CustomPropertiesLandingPageProps {
  onSelectEntityType: (entityType: Type) => void;
}
