/*
 *  Copyright 2024 Collate.
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

import { EntityType } from '../../enums/entity.enum';
import { EntityDetailsObjectInterface } from '../Explore/ExplorePage.interface';
import { OntologyNode } from './OntologyExplorer.interface';

const ASSET_NODE_TYPE = 'dataAsset';
const METRIC_NODE_TYPE = 'metric';

export function buildOntologySlideoutEntityDetails(
  node: OntologyNode
): EntityDetailsObjectInterface {
  const displayName = node.originalLabel ?? node.label;
  const name = node.label;

  if (node.type === ASSET_NODE_TYPE || node.type === METRIC_NODE_TYPE) {
    const ref = node.entityRef;
    if (ref?.id && ref.fullyQualifiedName && ref.type) {
      return {
        details: {
          id: ref.id,
          fullyQualifiedName: ref.fullyQualifiedName,
          entityType: ref.type as EntityType,
          name: ref.name ?? name,
          displayName: ref.displayName ?? displayName,
          description: node.description,
        },
      };
    }
  }

  if (node.type === 'glossaryTerm' || node.type === 'glossaryTermIsolated') {
    const source = node.originalNode ?? node;
    const termId = node.termId ?? source.id;
    const fqn = source.fullyQualifiedName ?? node.fullyQualifiedName;
    if (termId && fqn) {
      return {
        details: {
          id: termId,
          fullyQualifiedName: fqn,
          entityType: EntityType.GLOSSARY_TERM,
          name: source.label ?? name,
          displayName: source.originalLabel ?? source.label ?? displayName,
          description: source.description ?? node.description,
        },
      };
    }
  }

  if (node.type === 'glossary' && node.fullyQualifiedName) {
    return {
      details: {
        id: node.id,
        fullyQualifiedName: node.fullyQualifiedName,
        entityType: EntityType.GLOSSARY,
        name,
        displayName,
        description: node.description,
      },
    };
  }

  return {
    details: {
      id: node.id,
      fullyQualifiedName: node.fullyQualifiedName ?? node.id,
      entityType: EntityType.GLOSSARY_TERM,
      name,
      displayName,
      description: node.description,
    },
  };
}
