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
import { ASSET_NODE_TYPE, METRIC_NODE_TYPE } from './utils/graphBuilders';

function buildAssetOrMetricDetails(
  node: OntologyNode,
  name: string,
  displayName: string
): EntityDetailsObjectInterface | undefined {
  if (node.type !== ASSET_NODE_TYPE && node.type !== METRIC_NODE_TYPE) {
    return undefined;
  }

  const ref = node.entityRef;
  if (!(ref?.id && ref.fullyQualifiedName && ref.type)) {
    return undefined;
  }

  return {
    details: {
      ...(node.searchSource ?? {}),
      id: ref.id,
      fullyQualifiedName: ref.fullyQualifiedName,
      entityType: ref.type as EntityType,
      name: ref.name ?? name,
      displayName: ref.displayName ?? displayName,
      description: node.description,
    },
  };
}

const GLOSSARY_TERM_NODE_TYPES = ['glossaryTerm', 'glossaryTermIsolated'];

function resolveGlossaryTermSource(node: OntologyNode) {
  const source = node.originalNode ?? node;
  const termId = node.termId ?? source.id;
  const fqn = source.fullyQualifiedName ?? node.fullyQualifiedName;

  return { source, termId, fqn };
}

function buildGlossaryTermFields(
  node: OntologyNode,
  source: OntologyNode,
  name: string,
  displayName: string
) {
  return {
    name: source.label ?? name,
    displayName: source.originalLabel ?? source.label ?? displayName,
    description: source.description ?? node.description,
  };
}

function buildGlossaryTermDetails(
  node: OntologyNode,
  name: string,
  displayName: string
): EntityDetailsObjectInterface | undefined {
  if (!GLOSSARY_TERM_NODE_TYPES.includes(node.type)) {
    return undefined;
  }

  const { source, termId, fqn } = resolveGlossaryTermSource(node);
  if (!(termId && fqn)) {
    return undefined;
  }

  return {
    details: {
      id: termId,
      fullyQualifiedName: fqn,
      entityType: EntityType.GLOSSARY_TERM,
      ...buildGlossaryTermFields(node, source, name, displayName),
    },
  };
}

function buildGlossaryDetails(
  node: OntologyNode,
  name: string,
  displayName: string
): EntityDetailsObjectInterface | undefined {
  if (node.type !== 'glossary' || !node.fullyQualifiedName) {
    return undefined;
  }

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

function buildDefaultEntityDetails(
  node: OntologyNode,
  name: string,
  displayName: string
): EntityDetailsObjectInterface {
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

export function buildOntologySlideoutEntityDetails(
  node: OntologyNode
): EntityDetailsObjectInterface {
  const displayName = node.originalLabel ?? node.label;
  const name = node.label;

  return (
    buildAssetOrMetricDetails(node, name, displayName) ??
    buildGlossaryTermDetails(node, name, displayName) ??
    buildGlossaryDetails(node, name, displayName) ??
    buildDefaultEntityDetails(node, name, displayName)
  );
}
