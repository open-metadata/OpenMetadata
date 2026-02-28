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
import { EntityType } from '../../../../enums/entity.enum';
import { CustomProperty, Type } from '../../../../generated/entity/type';
import { EntityDetailsObjectInterface } from '../../ExplorePage.interface';

export interface EntityData {
  extension?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EntityDetails {
  details: {
    fullyQualifiedName?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface EntityTypeDetail {
  customProperties?: CustomProperty[];
  [key: string]: unknown;
}

export interface CustomPropertiesSectionProps {
  entityData?: EntityData;
  entityDetails?: EntityDetailsObjectInterface;
  emptyStateMessage?: string;
  viewCustomPropertiesPermission: boolean;
  entityType: EntityType;
  entityTypeDetail?: EntityTypeDetail | Type;
  isEntityDataLoading: boolean;
  hasEditPermissions: boolean;
  onExtensionUpdate: (
    updatedExtension: Record<string, unknown> | undefined
  ) => Promise<void>;
}
