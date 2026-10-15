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
import org.openmetadata.schema.entity.data.Glossary;

/**
 * The ontology IRI of a glossary: its configured {@code ontologyConfiguration.baseIri} when set,
 * otherwise its entity IRI. The export and the reasoning manifests use the same rule, so an
 * exported ontology and an activated closure name the same ontology.
 */
public final class GlossaryOntologyIri {
  private static final String GLOSSARY_PATH = "entity/glossary/";

  private GlossaryOntologyIri() {}

  public static String of(final Glossary glossary, final URI baseUri) {
    final URI configured =
        glossary.getOntologyConfiguration() == null
            ? null
            : glossary.getOntologyConfiguration().getBaseIri();
    return configured == null ? entityIri(glossary.getId(), baseUri) : configured.toString();
  }

  public static String entityIri(final UUID glossaryId, final URI baseUri) {
    return baseUri.resolve(GLOSSARY_PATH + glossaryId).toString();
  }
}
