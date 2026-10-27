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
export const isValidClassIdentity = (
  model: OntologyStudioModel,
  label: string,
  localName: string,
  source: string
): boolean =>
  [
    Boolean(label.trim()),
    isAvailableClassName(model, localName),
    !source.trim() || isAbsoluteOntologyIri(source.trim()),
  ].every(Boolean);
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
