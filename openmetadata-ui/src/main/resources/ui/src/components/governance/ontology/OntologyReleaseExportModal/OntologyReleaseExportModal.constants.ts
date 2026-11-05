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

import { OntologyReleaseExportFormat } from '../../../../rest/ontologyExport.constants';

export type OntologyReleaseExportCard = 'rdfxml' | 'skos' | 'jsonld' | 'csv';

interface OntologyReleaseExportFormatOption {
  readonly descriptionKey: string;
  readonly format: OntologyReleaseExportCard;
  readonly labelKey: string;
}

export const ONTOLOGY_RELEASE_EXPORT_FORMATS = [
  {
    descriptionKey: 'message.ontology-format-owl-description',
    format: 'rdfxml',
    labelKey: 'label.owl-rdf-xml',
  },
  {
    descriptionKey: 'message.ontology-format-skos-description',
    format: 'skos',
    labelKey: 'label.skos-skos-xl',
  },
  {
    descriptionKey: 'message.ontology-format-jsonld-description',
    format: 'jsonld',
    labelKey: 'label.json-ld',
  },
  {
    descriptionKey: 'message.ontology-format-csv-description',
    format: 'csv',
    labelKey: 'label.csv',
  },
] satisfies readonly OntologyReleaseExportFormatOption[];

/** The SKOS card writes SKOS-XL labels when the toggle is on; every other card is its own format. */
export const resolveExportFormat = (
  card: OntologyReleaseExportCard,
  skosXl: boolean
): OntologyReleaseExportFormat =>
  card === 'skos' && skosXl ? 'skos-xl' : card;

/** OWL and JSON-LD preview as Turtle, because the graph is the same and Turtle is readable. */
export const resolvePreviewFormat = (
  format: OntologyReleaseExportFormat
): OntologyReleaseExportFormat =>
  format === 'rdfxml' || format === 'jsonld' ? 'turtle' : format;

export const ONTOLOGY_RELEASE_PREVIEW_LIMIT = 1800;
