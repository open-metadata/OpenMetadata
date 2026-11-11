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
import { ConceptMappingType } from '../../../../generated/api/data/createOntologyChangeSet';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import { OwnPropertyDraft } from '../../../../utils/governance/ontology/OntologyNativeChangeSet.utils';
import {
  getConceptAncestors,
  getModelRelations,
  OntologyStudioModel,
  StudioDatatype,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  getNodeSize,
  MODEL_NODE_MAX_WIDTH,
  NODE_HEIGHT,
} from '../../../OntologyExplorer/utils/graphConfig';

export const classLocalName = (label: string): string =>
  label
    .trim()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean)
    .map((word) => word[0].toLocaleUpperCase() + word.slice(1))
    .join('');
export const distinctChipValues = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];
export const isValidLocalName = (name: string): boolean =>
  /^[\p{L}_][\p{L}\p{N}_-]*$/u.test(name);
export const inheritedClassProperties = (
  model: OntologyStudioModel,
  parentIris: readonly string[]
) => {
  const relations = getModelRelations(model);
  const parents = model.concepts.filter((c) => parentIris.includes(c.iri));
  const ancestors = new Set(
    parents.flatMap((parent) => [
      parent.id,
      ...getConceptAncestors(relations, parent.id).map((c) => c.id),
    ])
  );

  return model.properties.flatMap((property) => {
    const parent = model.concepts.find(
      (c) => ancestors.has(c.id) && property.domain?.includes(c.iri)
    );

    return parent ? [{ property, parent }] : [];
  });
};

export const placeNewClass = (
  positions: Record<string, { x: number; y: number }>,
  nodes: readonly { id: string }[],
  newId: string
): Record<string, { x: number; y: number }> | undefined => {
  if (
    nodes.some(
      (node) =>
        !positions[node.id] ||
        !Number.isFinite(positions[node.id].x) ||
        !Number.isFinite(positions[node.id].y)
    )
  ) {
    return undefined;
  }
  const [width, height] = getNodeSize({
    id: 'studio-class',
    data: { size: [MODEL_NODE_MAX_WIDTH, NODE_HEIGHT] },
  });
  const existing = nodes.map((node) => positions[node.id]);
  const gutter = 32;
  const right = Math.max(0, ...existing.map((p) => p.x + width / 2));
  const top = Math.min(0, ...existing.map((p) => p.y - height / 2));
  const candidates = Array.from({ length: 8 }, (_, index) => ({
    x: right + width / 2 + gutter,
    y: top + height / 2 + index * (height + gutter),
  }));
  const free = candidates.find((p) =>
    existing.every(
      (old) =>
        Math.abs(old.x - p.x) > width + gutter ||
        Math.abs(old.y - p.y) > height + gutter
    )
  ) ?? { x: right + width / 2 + 2 * gutter, y: top + height / 2 };

  return { ...positions, [newId]: free };
};

export const isAvailableClassName = (
  model: OntologyStudioModel,
  name: string
): boolean => {
  const iri = model.ontology.namespace + name;

  return (
    isValidLocalName(name) &&
    ![...model.concepts, ...model.properties].some(
      (definition) => definition.iri === iri
    )
  );
};
export type ClassIdentityIssue =
  | 'name-required'
  | 'name-invalid'
  | 'name-taken'
  | 'label-taken'
  | 'iri-invalid'
  | 'iri-taken'
  | 'source-invalid';

export interface ClassIdentityInput {
  displayName: string;
  localName: string;
  iri: string;
  source: string;
}

export const classIri = (
  namespace: string,
  localName: string,
  customIri: string
): string => customIri.trim() || namespace + localName.trim();

const normalizedLabel = (value: string): string =>
  value.trim().toLocaleLowerCase();

const nameIssues = (name: string, nameTaken: boolean): ClassIdentityIssue[] => {
  if (!name) {
    return ['name-required'];
  }
  if (!isValidLocalName(name)) {
    return ['name-invalid'];
  }

  return nameTaken ? ['name-taken'] : [];
};

const labelIssues = (
  model: OntologyStudioModel,
  input: ClassIdentityInput,
  name: string,
  nameTaken: boolean
): ClassIdentityIssue[] => {
  const label = input.displayName.trim() || name;
  const labelTaken =
    Boolean(label) &&
    model.concepts.some(
      (concept) =>
        normalizedLabel(concept.displayName ?? concept.name) ===
        normalizedLabel(label)
    );

  return labelTaken && !(nameTaken && !input.displayName.trim())
    ? ['label-taken']
    : [];
};

const iriIssues = (
  definitions: { iri: string }[],
  customIri: string
): ClassIdentityIssue[] => {
  if (!customIri) {
    return [];
  }
  if (!isAbsoluteOntologyIri(customIri)) {
    return ['iri-invalid'];
  }

  return definitions.some((definition) => definition.iri === customIri)
    ? ['iri-taken']
    : [];
};

export const classIdentityIssues = (
  model: OntologyStudioModel,
  input: ClassIdentityInput
): ClassIdentityIssue[] => {
  const name = input.localName.trim();
  const nameIri = model.ontology.namespace + name;
  const definitions = [...model.concepts, ...model.properties];
  const nameTaken = definitions.some(
    (definition) => definition.iri === nameIri
  );
  const source = input.source.trim();

  return [
    ...nameIssues(name, nameTaken),
    ...labelIssues(model, input, name, nameTaken),
    ...iriIssues(definitions, input.iri.trim()),
    ...(source && !isAbsoluteOntologyIri(source)
      ? ['source-invalid' as const]
      : []),
  ];
};
export interface MappingInput {
  mappingType: ConceptMappingType;
  conceptIri: string;
}
export const isValidMapping = (
  mappings: readonly MappingInput[],
  row: MappingInput
): boolean => {
  const conceptIri = row.conceptIri.trim();

  return (
    isAbsoluteOntologyIri(conceptIri) &&
    !mappings.some(
      (mapping) =>
        mapping.conceptIri === conceptIri &&
        mapping.mappingType === row.mappingType
    )
  );
};
export interface NewPropertyInput {
  name: string;
  datatype: StudioDatatype | 'object';
  range: string;
  isIdentifier: boolean;
  values: string[];
}
export const isValidOwnProperty = (
  model: OntologyStudioModel,
  properties: OwnPropertyDraft[],
  localName: string,
  row: NewPropertyInput
): boolean => {
  const name = row.name.trim();

  return [
    isAvailableClassName(model, name),
    !properties.some((p) => p.name === name),
    name !== localName,
    row.datatype !== 'enum' || row.values.length >= 2,
    row.datatype !== 'object' || Boolean(row.range),
  ].every(Boolean);
};
export const ownPropertyDraft = (row: NewPropertyInput): OwnPropertyDraft => {
  const common = { name: row.name.trim(), isIdentifier: row.isIdentifier };
  if (row.datatype === 'object') {
    return { ...common, kind: 'object', rangeIri: row.range };
  }
  if (row.datatype === 'enum') {
    return { ...common, kind: 'enum', values: row.values };
  }

  return { ...common, kind: 'data', datatype: row.datatype };
};
export const ownPropertyTypeLabel = (property: OwnPropertyDraft): string => {
  if (property.kind === 'data') {
    return property.datatype;
  }
  if (property.kind === 'enum') {
    return property.values.join(', ');
  }

  return property.rangeIri;
};
export const mappingTypeLabel = (type: ConceptMappingType): string => {
  const words = type.toLocaleLowerCase().replace(/_/g, ' ');

  return words[0].toLocaleUpperCase() + words.slice(1);
};
