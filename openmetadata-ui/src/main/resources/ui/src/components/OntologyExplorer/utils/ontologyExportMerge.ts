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

import { OntologyExportFormat } from '../../../rest/rdfAPI';

const RDF_ROOT_OPEN = /<rdf:RDF\b[^>]*>/i;
const RDF_ROOT_CLOSE = /<\/rdf:RDF\s*>/i;

function mergeJsonLd(parts: string[]): string {
  const graph: unknown[] = [];
  let context: unknown;
  parts.forEach((part) => {
    const parsed = JSON.parse(part) as Record<string, unknown>;
    context = context ?? parsed['@context'];
    const nodes = parsed['@graph'];
    if (Array.isArray(nodes)) {
      graph.push(...nodes);
    } else {
      const node = { ...parsed };
      delete node['@context'];
      graph.push(node);
    }
  });

  return JSON.stringify({ '@context': context, '@graph': graph }, null, 2);
}

function mergeRdfXml(parts: string[]): string {
  const openMatch = parts[0].match(RDF_ROOT_OPEN);
  const closeMatch = parts[0].match(RDF_ROOT_CLOSE);
  if (!openMatch || !closeMatch) {
    return parts.join('\n');
  }

  const header = parts[0].slice(0, openMatch.index! + openMatch[0].length);
  const bodies = parts.map((part) => {
    const open = part.match(RDF_ROOT_OPEN);
    const close = part.match(RDF_ROOT_CLOSE);
    if (!open || !close) {
      return '';
    }

    return part.slice(open.index! + open[0].length, close.index).trim();
  });

  return `${header}\n${bodies.filter(Boolean).join('\n')}\n</rdf:RDF>`;
}

/**
 * Combines multiple single-glossary ontology exports into one document so the
 * Studio can offer an "All glossaries" export without a server-side aggregate
 * endpoint. Turtle/N-Triples concatenate directly (repeated @prefix lines are
 * legal); JSON-LD merges into a single @graph; RDF/XML merges the triples under
 * a shared root element.
 */
export function mergeOntologyExports(
  parts: string[],
  format: OntologyExportFormat
): string {
  const nonEmpty = parts.map((part) => part.trim()).filter(Boolean);
  if (nonEmpty.length <= 1) {
    return nonEmpty[0] ?? '';
  }

  switch (format) {
    case 'jsonld':
      return mergeJsonLd(nonEmpty);
    case 'rdfxml':
      return mergeRdfXml(nonEmpty);
    case 'turtle':
    case 'ntriples':
    default:
      return nonEmpty.join('\n\n');
  }
}
