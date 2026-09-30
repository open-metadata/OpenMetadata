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
import type { TreeSelectNode } from '@openmetadata/ui-core-components';
import { EntityType } from '../../../enums/entity.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';

/** Map an EntityReference (the selected persona, or one mapped from a Persona)
 * into a flat, leaf TreeSelect node that round-trips the reference in `data`. */
export const entityRefToTreeNode = (
  ref: EntityReference
): TreeSelectNode<EntityReference> => {
  const id = ref.fullyQualifiedName ?? ref.name ?? ref.id;

  return { id, value: id, label: getEntityName(ref), data: ref, isLeaf: true };
};

export const personasToTreeNodes = (
  personas: Persona[]
): TreeSelectNode<EntityReference>[] =>
  personas.map((persona) =>
    entityRefToTreeNode(
      getEntityReferenceFromEntity<Persona>(persona, EntityType.PERSONA)
    )
  );
