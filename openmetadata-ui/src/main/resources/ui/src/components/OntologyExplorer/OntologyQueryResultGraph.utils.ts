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

import { Binding, Type } from '../../generated/api/rdf/sparqlResponse';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import {
  OntologyEdge,
  OntologyGraphData,
  OntologyNode,
} from './OntologyExplorer.interface';

type QueryBindingRow = Record<string, Binding>;

interface QueryTriple {
  object: Binding;
  predicate: Binding;
  subject: Binding;
}

const SUBJECT_VARIABLES = ['source', 'subject', 's'];
const PREDICATE_VARIABLES = ['predicate', 'relationship', 'p'];
const OBJECT_VARIABLES = ['target', 'object', 'o'];

function findUriBinding(
  row: QueryBindingRow,
  variableNames: string[]
): Binding | undefined {
  const variable = variableNames.find((name) => row[name]?.type === Type.URI);

  return variable ? row[variable] : undefined;
}

function toQueryTriple(
  row: QueryBindingRow,
  variables: string[]
): QueryTriple | undefined {
  const namedBindings = {
    object: findUriBinding(row, OBJECT_VARIABLES),
    predicate: findUriBinding(row, PREDICATE_VARIABLES),
    subject: findUriBinding(row, SUBJECT_VARIABLES),
  };
  const uriBindings = variables
    .map((variable) => row[variable])
    .filter((binding): binding is Binding => binding?.type === Type.URI);
  const subject = namedBindings.subject ?? uriBindings[0];
  const predicate = namedBindings.predicate ?? uriBindings[1];
  const object = namedBindings.object ?? uriBindings[2];
  let triple: QueryTriple | undefined;

  if (subject && predicate && object) {
    triple = { object, predicate, subject };
  }

  return triple;
}

function decodeUriTail(uri: string): string {
  const tail = uri.split(/[/#]/).filter(Boolean).at(-1) ?? uri;
  let decodedTail = tail;

  try {
    decodedTail = decodeURIComponent(tail);
  } catch {
    decodedTail = tail;
  }

  return decodedTail;
}

function findKnownNode(
  uri: string,
  knownGraph: OntologyGraphData | null
): OntologyNode | undefined {
  const uriTail = decodeUriTail(uri);

  return knownGraph?.nodes.find(
    (node) =>
      node.id === uriTail ||
      node.fullyQualifiedName === uriTail ||
      uri.endsWith(`/${node.id}`)
  );
}

function toQueryNode(
  uri: string,
  knownGraph: OntologyGraphData | null
): OntologyNode {
  const knownNode = findKnownNode(uri, knownGraph);

  return {
    ...knownNode,
    id: uri,
    label: knownNode?.originalLabel ?? knownNode?.label ?? decodeUriTail(uri),
    originalLabel: knownNode?.originalLabel ?? knownNode?.label,
    type: knownNode?.type ?? 'glossaryTerm',
  };
}

function getRelationshipLabel(
  predicate: string,
  relationshipTypes: RelationshipType[]
): string {
  const relationshipType = relationshipTypes.find(
    (candidate) => candidate.rdfPredicate === predicate
  );

  return (
    relationshipType?.displayName ??
    relationshipType?.name ??
    decodeUriTail(predicate)
  );
}

export function buildGraphFromSparqlBindings(
  rows: QueryBindingRow[],
  variables: string[],
  knownGraph: OntologyGraphData | null,
  relationshipTypes: RelationshipType[]
): OntologyGraphData {
  const nodesByUri: Record<string, OntologyNode> = {};
  const edgeKeys = new Set<string>();
  const edges = rows.flatMap((row) => {
    const triple = toQueryTriple(row, variables);
    const rowEdges: OntologyEdge[] = [];

    if (triple) {
      const { object, predicate, subject } = triple;
      const edgeKey = `${subject.value}\u0000${predicate.value}\u0000${object.value}`;
      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey);
        nodesByUri[subject.value] = toQueryNode(subject.value, knownGraph);
        nodesByUri[object.value] = toQueryNode(object.value, knownGraph);
        rowEdges.push({
          from: subject.value,
          label: getRelationshipLabel(predicate.value, relationshipTypes),
          relationType: predicate.value,
          to: object.value,
        });
      }
    }

    return rowEdges;
  });

  return { edges, nodes: Object.values(nodesByUri) };
}
