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

/** Keeps the host and the last two segments, as the design does: https://host/…/fhir/Record. */
export const shortenIri = (iri: string) => {
  const parts = iri.split('/');

  return parts.length > 5
    ? `${parts.slice(0, 3).join('/')}/…/${parts.slice(-2).join('/')}`
    : iri;
};

/**
 * The items in each of the design's five completeness sections: description, relationships,
 * properties, mappings and data assets. Rules and synonyms are optional refinements.
 */
export const getCompletenessCounts = (
  concept: Pick<OntologyConcept, 'description' | 'conceptMappings'>,
  counts: { relations: number; properties: number; assets: number }
) => [
  concept.description?.trim() ? 1 : 0,
  counts.relations,
  counts.properties,
  concept.conceptMappings?.length ?? 0,
  counts.assets,
];

/** The number of sections that have at least one item, as completeness counts them. */
export const countFilledSections = (counts: readonly number[]) =>
  counts.filter((count) => count > 0).length;
