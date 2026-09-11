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

import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';

export const permissionQueryKeys = {
  all: ['permissions'] as const,
  entity: (resource: ResourceEntity, fqn: string) =>
    [...permissionQueryKeys.all, 'entity', resource, fqn] as const,
  entityById: (resource: ResourceEntity, id: string) =>
    [...permissionQueryKeys.all, 'entityById', resource, id] as const,
  resource: (resource: ResourceEntity) =>
    [...permissionQueryKeys.all, 'resource', resource] as const,
};

/**
 * Permissions change rarely and active changes invalidate explicitly, so 5min
 * of freshness beats the repo default staleTime 0 (refetch per mount) AND the
 * old provider's forever-cache (stale-permission bug class, #27591).
 */
export const PERMISSION_STALE_TIME = 5 * 60 * 1000;
