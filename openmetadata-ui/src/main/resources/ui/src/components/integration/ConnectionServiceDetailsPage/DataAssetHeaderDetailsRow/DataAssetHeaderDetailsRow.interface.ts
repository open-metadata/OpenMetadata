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
import { Tag } from '../../../../generated/entity/classification/tag';
import { EntityReference } from '../../../../generated/entity/type';
import { TagLabel } from '../../../../generated/type/tagLabel';

export interface DataAssetHeaderDetailsRowProps {
  owners?: EntityReference[];
  domains?: EntityReference[];
  /** Full tags array — tier is extracted internally via getTierTags */
  tags?: TagLabel[];
  /** Optional inline control rendered in the meta row (e.g. the dashboard visibility control) */
  visibilitySlot?: ReactNode;
  hasEditPermission?: boolean;
  onUpdateDomain?: (
    domain: EntityReference | EntityReference[]
  ) => Promise<void>;
  onUpdateOwners?: (owners?: EntityReference[]) => Promise<void>;
  onUpdateTier?: (tier?: Tag) => Promise<void>;
  className?: string;
}
