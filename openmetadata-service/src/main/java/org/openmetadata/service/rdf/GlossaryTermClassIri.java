/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.rdf;

import java.net.URI;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;

/**
 * The one rule naming the OWL class of a glossary term: its authored {@code iri} when set,
 * otherwise its entity IRI. The live metadata projection keeps the entity IRI as the term record's
 * subject, because tags, realizations, relations and deletes all address the record by it; the
 * class IRI names the term only in OWL class axioms. Metadata records and classes are never joined
 * with {@code owl:sameAs}.
 */
public final class GlossaryTermClassIri {
  private static final String GLOSSARY_TERM_PATH = "entity/glossaryTerm/";

  private GlossaryTermClassIri() {}

  public static String of(final GlossaryTerm term, final URI baseUri) {
    final String iri =
        term.getIri() == null ? entityIri(term.getId(), baseUri) : term.getIri().toString();
    return iri;
  }

  public static String entityIri(final UUID termId, final URI baseUri) {
    return baseUri.resolve(GLOSSARY_TERM_PATH + termId).toString();
  }
}
