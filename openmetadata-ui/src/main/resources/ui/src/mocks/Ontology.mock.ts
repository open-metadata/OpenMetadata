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
  Category,
  PaletteKey,
  RelationshipType,
} from '../generated/entity/data/relationshipType';
import { EntityReference } from '../generated/entity/type';

const RELATIONSHIP_TYPE_ID = '00000000-0000-0000-0000-000000000001';

export const createRelationshipTypeMock = (
  overrides: Partial<RelationshipType> = {}
): RelationshipType => {
  const name = overrides.name ?? 'relatedTo';

  return {
    id: RELATIONSHIP_TYPE_ID,
    name,
    fullyQualifiedName: name,
    displayName: name,
    description: `${name} relationship`,
    rdfPredicate: `https://open-metadata.org/ontology/${name}`,
    category: Category.Custom,
    characteristics: [],
    crossGlossaryAllowed: true,
    paletteKey: PaletteKey.Blue,
    systemDefined: false,
    ...overrides,
  };
};

export const createRelationshipTypeReferenceMock = (
  name: string
): EntityReference => ({
  id: RELATIONSHIP_TYPE_ID,
  name,
  type: 'relationshipType',
});
