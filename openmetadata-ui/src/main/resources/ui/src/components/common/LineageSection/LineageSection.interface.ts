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

import { SxProps, Theme } from '@mui/material';
import { EntityType } from '../../../enums/entity.enum';

export interface LineageSectionProps {
  entityFqn?: string;
  entityType?: EntityType;
  onLineageClick?: () => void;
}
type LineageDirection = 'upstream' | 'downstream';

export interface LineageItemProps {
  type: LineageDirection;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  count: number;
  onClick?: () => void;
  sectionSx: SxProps<Theme>;
  iconWrapperSx: SxProps<Theme>;
  textSx: SxProps<Theme>;
}
