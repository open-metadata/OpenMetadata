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

import { OntologyImportFormat } from '../rest/importExportAPI';

const looksLikeRdfXml = (content: string): boolean => {
  const head = content.trimStart();

  return (
    head.startsWith('<?xml') ||
    head.startsWith('<rdf:RDF') ||
    head.startsWith('<RDF')
  );
};

export const ONTOLOGY_IMPORT_FORMAT_LABEL: Record<
  OntologyImportFormat,
  string
> = {
  ntriples: 'N-Triples',
  rdfxml: 'RDF/XML',
  turtle: 'Turtle',
};

export const detectOntologyImportFormat = (
  fileName: string,
  content: string
): OntologyImportFormat => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'rdf':
    case 'xml':
      return 'rdfxml';
    case 'owl':
      // .owl is not tied to one serialization: classic OWL is RDF/XML, but most
      // modern OWL 2 files are Turtle. Detect from the content instead of guessing.
      return looksLikeRdfXml(content) ? 'rdfxml' : 'turtle';
    case 'nt':
      return 'ntriples';
    default:
      return 'turtle';
  }
};
