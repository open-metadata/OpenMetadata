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
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  OntologyModelRelation,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';

export const DEFINITION_PAGE_SIZE = 25;
const SKOS_BROADER = 'http://www.w3.org/2004/02/skos/core#broader';

export interface ConceptRowFacts {
  readonly parents: readonly string[];
  readonly relations: number;
  readonly properties: number;
  readonly rules: number;
  /** 0–100, in steps of 20: description, relations, properties, rules, synonyms. */
  readonly completeness: number;
}

const countBy = <T>(items: readonly T[], keysOf: (item: T) => string[]) => {
  const counts = new Map<string, number>();
  items.forEach((item) =>
    new Set(keysOf(item)).forEach((key) =>
      counts.set(key, (counts.get(key) ?? 0) + 1)
    )
  );

  return counts;
};

/** The figures the Concepts table shows per row, all derived from the loaded model. */
export const getConceptRowFacts = (
  model: OntologyStudioModel,
  relations: readonly OntologyModelRelation[]
): Map<string, ConceptRowFacts> => {
  const nameByIri = new Map(
    model.concepts.map((concept) => [concept.iri, getEntityName(concept)])
  );
  const relationCounts = countBy(relations, (relation) => [
    relation.from.id,
    relation.to.id,
  ]);
  const propertyCounts = countBy(
    model.properties,
    (property) => property.domain ?? []
  );
  const ruleCounts = countBy(model.axioms, (axiom) => [axiom.subjectIri]);
  // A SKOS concept names its parent with skos:broader rather than a superclass.
  const broaderByConcept = new Map<string, string[]>();
  relations
    .filter((relation) => relation.propertyIri === SKOS_BROADER)
    .forEach((relation) =>
      broaderByConcept.set(relation.from.id, [
        ...(broaderByConcept.get(relation.from.id) ?? []),
        getEntityName(relation.to),
      ])
    );

  return new Map(
    model.concepts.map((concept) => {
      const facts = {
        relations: relationCounts.get(concept.id) ?? 0,
        properties: propertyCounts.get(concept.iri) ?? 0,
        rules: ruleCounts.get(concept.iri) ?? 0,
      };
      const filled = [
        Boolean(concept.description?.trim()),
        facts.relations > 0,
        facts.properties > 0,
        facts.rules > 0,
        (concept.synonyms?.length ?? 0) > 0,
      ].filter(Boolean).length;

      return [
        concept.id,
        {
          ...facts,
          parents: [
            ...(concept.superClasses ?? []).map(
              (iri) => nameByIri.get(iri) ?? iri
            ),
            ...(broaderByConcept.get(concept.id) ?? []),
          ],
          completeness: filled * 20,
        },
      ];
    })
  );
};

/** Amber while a concept is barely described, blue part way, green once most of it is there. */
export const completenessColor = (completeness: number) => {
  if (completeness >= 60) {
    return 'var(--tw-color-utility-success-500)';
  }

  return completeness >= 40
    ? 'var(--tw-color-utility-brand-500)'
    : 'var(--tw-color-utility-warning-500)';
};

/** "Person", "Person +1", or an empty string for a top-level concept. */
export const formatParents = (parents: readonly string[]) =>
  parents.length > 1
    ? `${parents[0]} +${parents.length - 1}`
    : parents[0] ?? '';

export type ConceptLevelFilter = 'any' | 'top' | 'child';

export const matchesSearch = (
  entity: Pick<OntologyConcept, 'name' | 'displayName'>,
  search: string
) => {
  const needle = search.trim().toLocaleLowerCase();

  return (
    !needle ||
    [entity.name, entity.displayName].some((value) =>
      value?.toLocaleLowerCase().includes(needle)
    )
  );
};

export const filterConcepts = (
  concepts: readonly OntologyConcept[],
  filters: {
    search: string;
    conceptType?: string;
    level: ConceptLevelFilter;
  }
) =>
  concepts.filter((concept) => {
    const isTopLevel = (concept.superClasses ?? []).length === 0;
    const levelMatches =
      filters.level === 'any' || (filters.level === 'top') === isTopLevel;

    return [
      matchesSearch(concept, filters.search),
      !filters.conceptType || concept.conceptType === filters.conceptType,
      levelMatches,
    ].every(Boolean);
  });

export const countPropertiesByKind = (
  properties: readonly OntologyProperty[]
): Record<Kind, number> => ({
  [Kind.Object]: properties.filter((property) => property.kind === Kind.Object)
    .length,
  [Kind.Data]: properties.filter((property) => property.kind === Kind.Data)
    .length,
  [Kind.Annotation]: properties.filter(
    (property) => property.kind === Kind.Annotation
  ).length,
});

/** Shows a domain or range IRI by its concept name, a datatype by its local name. */
export const iriLabel = (iri: string, nameByIri: ReadonlyMap<string, string>) =>
  nameByIri.get(iri) ?? iri.split(/[#/]/).pop() ?? iri;

/** Swaps every full IRI left in a sentence for its local name, so a row stays readable. */
export const shortenIris = (sentence: string) =>
  sentence.replace(
    /\b(?:https?|urn):\S+/g,
    (iri) => iri.split(/[#/:]/).filter(Boolean).pop() ?? iri
  );

export const pageOf = <T>(items: readonly T[], page: number) =>
  items.slice(page * DEFINITION_PAGE_SIZE, (page + 1) * DEFINITION_PAGE_SIZE);

export const pageCount = (total: number) =>
  Math.max(1, Math.ceil(total / DEFINITION_PAGE_SIZE));
