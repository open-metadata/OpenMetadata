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

import type { BadgeColors } from '@openmetadata/ui-core-components';
import { RelationCategory } from './KnowledgeGraph.relations';

/**
 * Chips shown per cell before the rest collapse behind "+N more".
 * ADR:2026-10-19-kg-inspector-expands-relationships-inline
 */
export const CHIP_LIMIT = 5;

export const FAMILY_BADGE_COLORS: Record<RelationCategory, BadgeColors> = {
  lineage: 'blue-dark',
  structure: 'gray-blue',
  ontology: 'purple',
  governance: 'success',
  ownership: 'orange',
  quality: 'pink',
  other: 'gray',
};
