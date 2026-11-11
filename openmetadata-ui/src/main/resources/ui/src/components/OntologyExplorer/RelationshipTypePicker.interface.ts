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
  /** A short gloss shown beside the label; the inverse is shown when absent. */
  description?: string;
  /** Concept ids the relation may start from and point at; empty or absent allows any. */
  domain?: readonly string[];
  range?: readonly string[];
  /** "Domain → Range", shown for a relation that does not fit the chosen ends. */
  scopeLabel?: string;
  isDisabled?: boolean;
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
  /** Concept ids of the ends; relations whose domain or range leaves them out are shown disabled. */
  sourceId?: string;
  targetId?: string;
  onCancel?: () => void;
  className?: string;
  /** Options to offer; glossary relationship types are loaded when absent. */
  groups?: RelationTypeOptionGroup[];
  /** Offers the search text as a new relationship type when nothing matches it exactly. */
  canCreateType?: boolean;
  /** The reason a choice cannot be written, or undefined; the picker shows it instead of selecting. */
  checkRelation?: (relationType: string) => string | undefined;
  /** A server warning for a choice that can still be written; the picker shows it and waits for Add anyway. */
  warnRelation?: (relationType: string) => Promise<string | undefined>;
}
