/*
 *  Copyright 2025 Collate.
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
import { CustomProperty, Type } from '../../../../generated/entity/type';

export interface EntityData {
  extension?: Record<string, unknown>;
}

export interface EntityTypeDetail {
  customProperties?: CustomProperty[];
  [key: string]: unknown;
}

export interface CustomPropertiesSectionProps {
  entityData?: EntityData;
  emptyStateMessage?: string;
  viewCustomPropertiesPermission: boolean;
  entityTypeDetail?: EntityTypeDetail | Type;
  isEntityDataLoading: boolean;
  hasEditPermissions: boolean;
  onExtensionUpdate: (
    updatedExtension: Record<string, unknown> | undefined
  ) => Promise<void>;
}
