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

import {
  Characteristic,
  PaletteKey,
  RelationshipType,
} from '../../../generated/entity/data/relationshipType';

const HIERARCHICAL_RELATION_NAMES = new Set([
  'broader',
  'childOf',
  'hasPart',
  'isA',
  'narrower',
  'parentOf',
  'partOf',
  'subClassOf',
  'typeOf',
]);

const HIERARCHICAL_PREDICATES = new Set([
  'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  'http://www.w3.org/2004/02/skos/core#broader',
  'http://www.w3.org/2004/02/skos/core#broaderTransitive',
  'http://www.w3.org/2004/02/skos/core#narrower',
  'http://www.w3.org/2004/02/skos/core#narrowerTransitive',
]);

const PALETTE_COLOR_TOKENS: Record<PaletteKey, string> = {
  [PaletteKey.Amber]: 'var(--color-utility-warning-500)',
  [PaletteKey.Blue]: 'var(--color-utility-blue-500)',
  [PaletteKey.Gray]: 'var(--color-utility-gray-500)',
  [PaletteKey.Green]: 'var(--color-utility-success-500)',
  [PaletteKey.Indigo]: 'var(--color-utility-indigo-500)',
  [PaletteKey.Pink]: 'var(--color-utility-pink-500)',
  [PaletteKey.Purple]: 'var(--color-utility-purple-500)',
  [PaletteKey.Rose]: 'var(--color-fg-error-primary)',
  [PaletteKey.Teal]: 'var(--color-utility-success-600)',
  [PaletteKey.Violet]: 'var(--color-utility-purple-600)',
};

export const getInverseRelationshipName = (
  relationshipType: RelationshipType
): string | undefined => relationshipType.inverse?.name;

export const isSymmetricRelationship = (
  relationshipType: RelationshipType
): boolean =>
  relationshipType.characteristics.includes(Characteristic.Symmetric);

export const isHierarchicalRelationship = (
  relationshipType: RelationshipType
): boolean =>
  HIERARCHICAL_RELATION_NAMES.has(relationshipType.name) ||
  HIERARCHICAL_PREDICATES.has(relationshipType.rdfPredicate);

export const getRelationshipColor = (
  relationshipType: RelationshipType
): string => PALETTE_COLOR_TOKENS[relationshipType.paletteKey];

export const getRelationshipCardinalityLabels = (
  relationshipType: RelationshipType
): { startLabelText: string; endLabelText: string } | null => {
  const cardinality = relationshipType.cardinality;
  const labels = cardinality
    ? {
        startLabelText: cardinality.targetMax === 1 ? '1' : 'M',
        endLabelText: cardinality.sourceMax === 1 ? '1' : 'M',
      }
    : null;

  return labels;
};
