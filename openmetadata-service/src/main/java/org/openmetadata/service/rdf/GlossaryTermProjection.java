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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.SKOS;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;

/** Projects glossary terms as a business vocabulary. */
final class GlossaryTermProjection {
  private final Model model;
  private final URI publicBaseUri;

  GlossaryTermProjection(final Model model, final URI publicBaseUri) {
    this.model = model;
    this.publicBaseUri = publicBaseUri;
  }

  Map<UUID, Resource> addTerms(final Resource scheme, final List<GlossaryTerm> terms) {
    final Map<UUID, Resource> resources = new HashMap<>();
    terms.forEach(term -> resources.put(term.getId(), addTerm(scheme, term)));
    return resources;
  }

  private Resource addTerm(final Resource scheme, final GlossaryTerm term) {
    final Resource resource = model.createResource(GlossaryTermClassIri.of(term, publicBaseUri));
    GlossaryOntologyModelBuilder.addType(model, resource, SKOS.Concept.getURI());
    GlossaryOntologyModelBuilder.addType(
        model, resource, GlossaryOntologyModelBuilder.GLOSSARY_TERM_CLASS);
    GlossaryOntologyModelBuilder.addObjectProperty(model, resource, SKOS.inScheme, scheme);
    GlossaryOntologyModelBuilder.addLiteral(model, resource, SKOS.prefLabel, displayName(term));
    GlossaryOntologyModelBuilder.addFullyQualifiedName(
        model, resource, term.getFullyQualifiedName());
    GlossaryOntologyModelBuilder.addLiteral(
        model, resource, SKOS.definition, term.getDescription());
    listOrEmpty(term.getSynonyms())
        .forEach(
            value ->
                GlossaryOntologyModelBuilder.addLiteral(model, resource, SKOS.altLabel, value));
    if (term.getEntityStatus() == EntityStatus.DEPRECATED) {
      resource.addLiteral(OWL2.deprecated, true);
    }
    return resource;
  }

  private static String displayName(final GlossaryTerm term) {
    return term.getDisplayName() == null ? term.getName() : term.getDisplayName();
  }
}
