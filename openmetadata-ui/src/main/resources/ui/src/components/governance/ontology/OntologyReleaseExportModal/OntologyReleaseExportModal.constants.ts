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

import { OntologyExportFormat } from '../../../../rest/rdfAPI';

interface OntologyReleaseExportFormatOption {
  readonly descriptionKey: string;
  readonly format: OntologyExportFormat;
  readonly labelKey: string;
}

export const ONTOLOGY_RELEASE_EXPORT_FORMATS = [
  {
    descriptionKey: 'message.ontology-format-owl-description',
    format: 'rdfxml',
    labelKey: 'label.rdf-xml-rdf',
  },
  {
    descriptionKey: 'message.ontology-format-skos-description',
    format: 'turtle',
    labelKey: 'label.turtle-ttl',
  },
  {
    descriptionKey: 'message.ontology-format-jsonld-description',
    format: 'jsonld',
    labelKey: 'label.json-ld',
  },
  {
    descriptionKey: 'message.ontology-format-n-triples-description',
    format: 'ntriples',
    labelKey: 'label.n-triples-nt',
  },
] satisfies readonly OntologyReleaseExportFormatOption[];

export const ONTOLOGY_RELEASE_PREVIEW_LIMIT = 1800;
