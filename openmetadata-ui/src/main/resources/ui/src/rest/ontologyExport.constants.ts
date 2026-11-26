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

import type { OntologyReleaseExportOptions } from '../generated/api/data/ontologyReleaseExportOptions';
import type { NativeOntologyExportFormat } from '../generated/type/nativeOntologyExportFormat';

export type OntologyReleaseExportFormat = `${NativeOntologyExportFormat}`;

export const ONTOLOGY_RELEASE_EXPORT_DEFAULTS = {
  includeBoundAssets: false,
  includeInverses: true,
  shaclGate: false,
} satisfies Required<OntologyReleaseExportOptions>;

const TURTLE_MEDIA_TYPE = 'text/turtle';

export const NATIVE_EXPORT_MEDIA_TYPES = {
  csv: 'text/csv',
  jsonld: 'application/ld+json',
  ntriples: 'application/n-triples',
  rdfxml: 'application/rdf+xml',
  skos: TURTLE_MEDIA_TYPE,
  'skos-xl': TURTLE_MEDIA_TYPE,
  turtle: TURTLE_MEDIA_TYPE,
} satisfies Record<OntologyReleaseExportFormat, string>;

export const NATIVE_EXPORT_EXTENSIONS = {
  csv: 'csv',
  jsonld: 'jsonld',
  ntriples: 'nt',
  rdfxml: 'rdf',
  skos: 'ttl',
  'skos-xl': 'ttl',
  turtle: 'ttl',
} satisfies Record<OntologyReleaseExportFormat, string>;
