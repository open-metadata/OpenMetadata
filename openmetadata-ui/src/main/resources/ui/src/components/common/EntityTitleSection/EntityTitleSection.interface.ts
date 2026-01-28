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

import { TooltipPlacement } from 'antd/es/tooltip';
import { EntityType } from '../../../enums/entity.enum';

export interface EntityTitleSectionProps {
  entityDetails: {
    id?: string;
    entityType?: string;
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
    description?: string;
    [key: string]: unknown;
  };
  entityLink: string | { pathname: string };
  entityType?: EntityType;
  tooltipPlacement?: TooltipPlacement;
  testId?: string;
  className?: string;
  hasEditPermission?: boolean;
  entityDisplayName?: string;
  onDisplayNameUpdate?: (updatedDisplayName: string) => void;
}
