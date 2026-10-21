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

import { PaletteKey } from '../../generated/entity/data/relationshipType';

export interface RelationTypeOption {
  /** Value passed to `onSelect`. */
  id: string;
  label: string;
  inverseLabel?: string;
  paletteKey: PaletteKey;
}

export interface RelationTypeOptionGroup {
  id: string;
  title: string;
  options: RelationTypeOption[];
}

export interface RelationshipTypePickerProps {
  /** Called with the selected option id, e.g. 'broader', or `new:<label>` for a new type. */
  onSelect: (relationType: string) => void;
  sourceLabel: string;
  targetLabel: string;
  onCancel?: () => void;
  className?: string;
  /** Options to offer; glossary relationship types are loaded when absent. */
  groups?: RelationTypeOptionGroup[];
  /** Offers the search text as a new relationship type when nothing matches it exactly. */
  canCreateType?: boolean;
}
