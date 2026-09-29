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

import {
  RDFTerm,
  SparqlTripleTerm,
  Type,
} from '../../generated/api/rdf/sparqlResponse';

/**
 * Renders one SPARQL 1.2 Query Results JSON term as display text. Mirrors SparqlTermFormatter on
 * the server.
 *
 * Every other term type carries its text in `value`, but an RDF 1.2 triple term carries a nested
 * subject/predicate/object object there instead. Rendering that object straight into JSX throws
 * "Objects are not valid as a React child" and takes the whole results panel down, so it is
 * rendered in N-Triples syntax here.
 */

export const isTripleTerm = (term?: RDFTerm): boolean =>
  term?.type === Type.Triple;

/** The lexical string of a non-triple term, or '' when the term carries a nested triple. */
export const getTermLexicalValue = (term?: RDFTerm): string =>
  typeof term?.value === 'string' ? term.value : '';

const escapeLexicalForm = (lexicalForm: string): string =>
  lexicalForm
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');

const getLiteralSuffix = (term?: RDFTerm): string => {
  const language = term?.['xml:lang'] ?? '';
  const direction = term?.['its:dir'] ?? '';

  if (language) {
    return direction ? `@${language}--${direction}` : `@${language}`;
  }

  return term?.datatype ? `^^<${term.datatype}>` : '';
};

const getLiteralSyntax = (term?: RDFTerm): string =>
  `"${escapeLexicalForm(getTermLexicalValue(term))}"${getLiteralSuffix(term)}`;

/**
 * Nested terms use full syntax — angle brackets, quotes, language and direction tags — because
 * inside a triple term a bare lexical form cannot be told apart from an IRI.
 */
const getTermSyntax = (term?: RDFTerm): string => {
  switch (term?.type) {
    case Type.URI:
      return `<${getTermLexicalValue(term)}>`;
    case Type.Bnode:
      return `_:${getTermLexicalValue(term)}`;
    case Type.Triple: {
      const { object, predicate, subject } = term.value as SparqlTripleTerm;

      return `<<( ${getTermSyntax(subject)} ${getTermSyntax(
        predicate
      )} ${getTermSyntax(object)} )>>`;
    }
    default:
      return getLiteralSyntax(term);
  }
};

export const getTermDisplayText = (term?: RDFTerm): string =>
  isTripleTerm(term) ? getTermSyntax(term) : getTermLexicalValue(term);
