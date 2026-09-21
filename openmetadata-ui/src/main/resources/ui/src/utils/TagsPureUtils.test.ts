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
import {
  ResourceEntity,
  UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { Operation } from '../generated/entity/policies/policy';
import { getExcludedIndexesBasedOnEntityTypeEditTagPermission } from './TagsPureUtils';

const buildPermissions = (resource: ResourceEntity): UIPermission =>
  ({
    [resource]: { [Operation.EditTags]: true },
  } as unknown as UIPermission);

describe('getExcludedIndexesBasedOnEntityTypeEditTagPermission', () => {
  it('should grant MESSAGING_SERVICE when EditTags is held on messagingService', () => {
    const permissions = buildPermissions(ResourceEntity.MESSAGING_SERVICE);

    const { entitiesHavingPermission, entitiesNotHavingPermission } =
      getExcludedIndexesBasedOnEntityTypeEditTagPermission(permissions);

    expect(entitiesHavingPermission).toContain(EntityType.MESSAGING_SERVICE);
    expect(entitiesNotHavingPermission).not.toContain(
      EntityType.MESSAGING_SERVICE
    );
  });

  it('should not grant MESSAGING_SERVICE when EditTags is held only on pipelineService', () => {
    const permissions = buildPermissions(ResourceEntity.PIPELINE_SERVICE);

    const { entitiesHavingPermission, entitiesNotHavingPermission } =
      getExcludedIndexesBasedOnEntityTypeEditTagPermission(permissions);

    expect(entitiesHavingPermission).toContain(EntityType.PIPELINE_SERVICE);
    expect(entitiesNotHavingPermission).toContain(EntityType.MESSAGING_SERVICE);
  });
});
