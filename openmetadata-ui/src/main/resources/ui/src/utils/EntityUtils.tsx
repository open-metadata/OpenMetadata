/*
 *  Copyright 2022 Collate.
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

/**
 * Residual EntityUtils barrel.
 *
 * Most symbols have been moved to focused modules — import directly:
 *   - EntityNameUtils, EntityLinkUtils, EntityBreadcrumbUtils,
 *     EntityColumnUtils, EntitySearchUtils, EntitySortUtils,
 *     EntityVoteUtils, EntityPermissionUtils, EntityTagUtils,
 *     EntityReferenceUtils
 *
 * Only getEntityLabel and DRAWER_NAVIGATION_OPTIONS remain here.
 */

import { Space, Typography } from 'antd';
import { getEntityName } from './EntityNameUtils';

// getEntityLabel renders JSX using Antd — kept here since it's a lightweight inline component
// and moving it would require updating all imports to EntityDisplayUtils.tsx
export const getEntityLabel = (entity: {
  displayName?: string;
  name?: string;
  fullyQualifiedName?: string;
}): JSX.Element => (
  <Space className="w-full whitespace-normal" direction="vertical" size={0}>
    <Typography.Paragraph className="m-b-0">
      {getEntityName(entity)}
    </Typography.Paragraph>
    <Typography.Paragraph className="text-grey-muted text-xs">
      {entity?.fullyQualifiedName}
    </Typography.Paragraph>
  </Space>
);

export enum DRAWER_NAVIGATION_OPTIONS {
  explore = 'Explore',
  lineage = 'Lineage',
}
