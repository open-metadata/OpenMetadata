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

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;

/**
 * Declares the entities of the ontology projection so the OWL 2 RDF mapping reads every IRI with
 * one kind instead of guessing it. Built-in RDF, RDFS, OWL and XSD vocabulary is never declared or
 * given property axioms: OWL 2 DL forbids redefining it. SKOS terms keep the kind the SKOS
 * reference vocabulary gives them, whatever kind a caller asks for, so an export never contradicts
 * SKOS when both are loaded together.
 *
 * <p>See ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule.
 */
public final class OwlEntityDeclarations {
  private static final Set<String> BUILT_IN_NAMESPACES = Set.of(RDF.uri, RDFS.uri, OWL2.NS, XSD.NS);
  private static final Set<String> NON_XSD_DATATYPES =
      Set.of(
          RDFS.Literal.getURI(),
          RDF.PlainLiteral.getURI(),
          RDF.langString.getURI(),
          RDF.xmlLiteral.getURI(),
          OWL2.NS + "real",
          OWL2.NS + "rational");
  private static final Map<String, EntityKind> SKOS_KINDS = skosKinds();
  private static final Set<String> BUILT_IN_ANNOTATIONS =
      Set.of(
          RDFS.label.getURI(),
          RDFS.comment.getURI(),
          RDFS.seeAlso.getURI(),
          RDFS.isDefinedBy.getURI(),
          OWL2.versionInfo.getURI(),
          OWL2.priorVersion.getURI(),
          OWL2.backwardCompatibleWith.getURI(),
          OWL2.incompatibleWith.getURI(),
          OWL2.deprecated.getURI());

  private OwlEntityDeclarations() {}

  /** The kinds of entity an OWL 2 declaration names. */
  public enum EntityKind {
    CLASS(OWL2.Class),
    DATATYPE(RDFS.Datatype),
    OBJECT_PROPERTY(OWL2.ObjectProperty),
    DATA_PROPERTY(OWL2.DatatypeProperty),
    ANNOTATION_PROPERTY(OWL2.AnnotationProperty),
    NAMED_INDIVIDUAL(OWL2.NamedIndividual);

    private final Resource declarationType;

    EntityKind(final Resource declarationType) {
      this.declarationType = declarationType;
    }
  }

  public static void declare(final Model model, final String iri, final EntityKind requested) {
    if (!isBuiltIn(iri)) {
      final EntityKind kind = isSkos(iri) ? SKOS_KINDS.getOrDefault(iri, requested) : requested;
      model.createResource(iri).addProperty(RDF.type, kind.declarationType);
    }
  }

  public static void declare(final Model model, final Resource entity, final EntityKind kind) {
    if (entity.isURIResource()) {
      declare(model, entity.getURI(), kind);
    }
  }

  /** RDF, RDFS, OWL and XSD vocabulary, whose meaning OWL 2 fixes. */
  public static boolean isBuiltIn(final String iri) {
    return iri != null && BUILT_IN_NAMESPACES.stream().anyMatch(iri::startsWith);
  }

  /**
   * Vocabulary an authored relationship type may name as its predicate but must not redefine: the
   * built-in namespaces plus SKOS. Such a type keeps the predicate's own meaning, so it never
   * receives OWL property characteristics, inverses, chains or disjointness.
   */
  public static boolean isReservedVocabulary(final String iri) {
    return isBuiltIn(iri) || isSkos(iri);
  }

  /** Datatypes a restriction filler can name: XSD, {@code rdfs:Literal} and the OWL 2 extras. */
  public static boolean isDatatype(final String iri) {
    return iri != null && (iri.startsWith(XSD.NS) || NON_XSD_DATATYPES.contains(iri));
  }

  /** Fixed vocabulary kinds can be resolved without redefining or fetching remote terms. */
  public static EntityKind vocabularyKind(final String iri) {
    if (OWL2.topObjectProperty.getURI().equals(iri)
        || OWL2.bottomObjectProperty.getURI().equals(iri)) {
      return EntityKind.OBJECT_PROPERTY;
    }
    if (OWL2.topDataProperty.getURI().equals(iri) || OWL2.bottomDataProperty.getURI().equals(iri)) {
      return EntityKind.DATA_PROPERTY;
    }
    return BUILT_IN_ANNOTATIONS.contains(iri)
        ? EntityKind.ANNOTATION_PROPERTY
        : SKOS_KINDS.get(iri);
  }

  private static boolean isSkos(final String iri) {
    return iri != null && iri.startsWith(SKOS.uri);
  }

  /** Kinds from the W3C SKOS reference vocabulary (2009). */
  private static Map<String, EntityKind> skosKinds() {
    final Map<String, EntityKind> kinds = new HashMap<>();
    Set.of(SKOS.Concept, SKOS.ConceptScheme, SKOS.Collection, SKOS.OrderedCollection)
        .forEach(resource -> kinds.put(resource.getURI(), EntityKind.CLASS));
    Set.of(
            SKOS.semanticRelation,
            SKOS.broader,
            SKOS.narrower,
            SKOS.related,
            SKOS.broaderTransitive,
            SKOS.narrowerTransitive,
            SKOS.mappingRelation,
            SKOS.closeMatch,
            SKOS.exactMatch,
            SKOS.broadMatch,
            SKOS.narrowMatch,
            SKOS.relatedMatch,
            SKOS.inScheme,
            SKOS.hasTopConcept,
            SKOS.topConceptOf,
            SKOS.member,
            SKOS.memberList)
        .forEach(property -> kinds.put(property.getURI(), EntityKind.OBJECT_PROPERTY));
    Set.of(
            SKOS.prefLabel,
            SKOS.altLabel,
            SKOS.hiddenLabel,
            SKOS.note,
            SKOS.changeNote,
            SKOS.definition,
            SKOS.editorialNote,
            SKOS.example,
            SKOS.historyNote,
            SKOS.scopeNote)
        .forEach(property -> kinds.put(property.getURI(), EntityKind.ANNOTATION_PROPERTY));
    kinds.put(SKOS.notation.getURI(), EntityKind.DATA_PROPERTY);
    return Map.copyOf(kinds);
  }
}
