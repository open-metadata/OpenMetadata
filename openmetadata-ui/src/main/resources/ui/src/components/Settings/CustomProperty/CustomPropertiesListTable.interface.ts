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
import { ReactNode } from 'react';
import { CustomProperty } from '../../../generated/type/customProperty';

export interface CustomPropertiesListTableProps {
  customProperties: CustomProperty[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  emptyText: ReactNode;
  containerClassName?: string;
  'data-testid'?: string;
  onEdit: (property: CustomProperty) => void;
  onDelete: (property: CustomProperty) => void;
}

export interface CustomPropertyConfigCellProps {
  property: CustomProperty;
}

export interface CustomPropertyActionsProps {
  property: CustomProperty;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (property: CustomProperty) => void;
  onDelete: (property: CustomProperty) => void;
}
