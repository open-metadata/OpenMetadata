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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';

// The usage endpoints drop domain and data-product references, so linking there would silently no-op.
const ENTITY_TYPES_WITHOUT_ARTICLE_LINKS = new Set<string>([
  EntityType.DOMAIN,
  EntityType.DATA_PRODUCT,
]);

/**
 * Linking edits the entity's article list but writes to each article, which the
 * server authorizes as EditAll on the article — so both grants are required.
 */
export const canLinkArticlesToEntity = ({
  entityType,
  entityPermissions,
  articlePermissions = DEFAULT_ENTITY_PERMISSION,
  deleted,
}: {
  entityType: string;
  entityPermissions: OperationPermission;
  articlePermissions?: OperationPermission;
  deleted?: boolean;
}): boolean =>
  !ENTITY_TYPES_WITHOUT_ARTICLE_LINKS.has(entityType) &&
  getDerivedPermissionFlags(entityPermissions, deleted).canEditAll &&
  getDerivedPermissionFlags(articlePermissions).canEditAll;
