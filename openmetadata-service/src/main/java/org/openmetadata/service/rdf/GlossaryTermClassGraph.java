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
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDFS;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;
import org.openmetadata.service.rdf.translator.RdfRealizationMapper;

/**
 * The OWL view of one glossary term, written to the term's own graph: its class declaration, the
 * subclass axiom its parent link makes, and its attributes as data properties. The term record in
 * the knowledge graph keeps the SKOS and catalog view under the entity IRI.
 *
 * <p>When the class IRI is not the entity IRI, the term's realizations are repeated on the class
 * IRI, so a class hierarchy reaches mapped assets in one hop. See
 * ADR:2026-10-14-mapped-assets-are-reached-from-the-term-class-iri.
 */
final class GlossaryTermClassGraph {
  private static final String MAPPED_TO = "https://open-metadata.org/ontology/mappedTo";

  private GlossaryTermClassGraph() {}

  /**
   * @param parent the term's parent term, or null when it has none or the parent no longer exists
   */
  static Model build(final GlossaryTerm term, final GlossaryTerm parent, final URI baseUri) {
    final Model model = ModelFactory.createDefaultModel();
    if (Boolean.TRUE.equals(term.getDeleted())) {
      return model;
    }
    final Resource termClass = model.createResource(GlossaryTermClassIri.of(term, baseUri));
    final boolean isOwlClass = GlossaryTermProjection.isOwlClass(term);
    if (isOwlClass) {
      OwlEntityDeclarations.declare(model, termClass, EntityKind.CLASS);
      addParentSubclass(model, termClass, parent, baseUri);
      if (term.getEntityStatus() == EntityStatus.DEPRECATED) {
        termClass.addLiteral(OWL2.deprecated, true);
      }
    }
    GlossaryTermProjection.addAttributes(model, termClass, isOwlClass, term.getAttributes());
    if (!termClass.getURI().equals(GlossaryTermClassIri.entityIri(term.getId(), baseUri))) {
      addRealizations(model, termClass, term, baseUri);
    }
    return model;
  }

  /**
   * A parent link is subsumption when both terms are OWL classes, as in the export. See
   * ADR:2026-10-11-glossary-dates-are-xsd-datetime-and-skos-parents-are-not-superclasses.
   */
  private static void addParentSubclass(
      final Model model, final Resource termClass, final GlossaryTerm parent, final URI baseUri) {
    if (parent != null
        && !Boolean.TRUE.equals(parent.getDeleted())
        && GlossaryTermProjection.isOwlClass(parent)) {
      final Resource parentClass = model.createResource(GlossaryTermClassIri.of(parent, baseUri));
      OwlEntityDeclarations.declare(model, parentClass, EntityKind.CLASS);
      termClass.addProperty(RDFS.subClassOf, parentClass);
    }
  }

  private static void addRealizations(
      final Model model, final Resource termClass, final GlossaryTerm term, final URI baseUri) {
    for (final AssetRealization realization : listOrEmpty(term.getRealizedIn())) {
      final EntityReference asset = realization.getAsset();
      if (asset != null && asset.getId() != null && asset.getType() != null) {
        final Resource assetResource =
            model.createResource(
                baseUri.resolve("entity/" + asset.getType() + "/" + asset.getId()).toString());
        addObjectProperty(model, termClass, MAPPED_TO, assetResource);
        addObjectProperty(
            model,
            termClass,
            RdfRealizationMapper.rolePredicate(realization.getRole()),
            assetResource);
      }
    }
  }

  private static void addObjectProperty(
      final Model model, final Resource subject, final String predicate, final Resource object) {
    OwlEntityDeclarations.declare(model, predicate, EntityKind.OBJECT_PROPERTY);
    subject.addProperty(model.createProperty(predicate), object);
  }
}
