package org.openmetadata.service.rdf;

import java.util.Set;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.SKOS;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.type.RelationshipCharacteristic;

final class OntologyRdfVocabulary {
  static final String NAMESPACE = "https://open-metadata.org/ontology/";
  static final Property UNIT =
      ResourceFactory.createProperty("https://open-metadata.org/ontology/unitAnnotation");
  static final Property IDENTIFIER_INTENT =
      ResourceFactory.createProperty("https://open-metadata.org/ontology/identifierIntent");
  static final Property ABSTRACT = ResourceFactory.createProperty(NAMESPACE + "abstract");
  static final Set<Resource> ANNOTATIONS =
      Set.of(DCTerms.source, DCTerms.isReplacedBy, UNIT, IDENTIFIER_INTENT, ABSTRACT);

  private OntologyRdfVocabulary() {}

  static Resource characteristic(final RelationshipCharacteristic characteristic) {
    return switch (characteristic) {
      case SYMMETRIC -> OWL2.SymmetricProperty;
      case TRANSITIVE -> OWL2.TransitiveProperty;
      case FUNCTIONAL -> OWL2.FunctionalProperty;
      case INVERSE_FUNCTIONAL -> OWL2.InverseFunctionalProperty;
      case REFLEXIVE -> OWL2.ReflexiveProperty;
      case IRREFLEXIVE -> OWL2.IrreflexiveProperty;
      case ASYMMETRIC -> OWL2.AsymmetricProperty;
    };
  }

  static Property mapping(final ConceptMapping.ConceptMappingType type) {
    return switch (type) {
      case EXACT_MATCH -> SKOS.exactMatch;
      case CLOSE_MATCH -> SKOS.closeMatch;
      case BROAD_MATCH -> SKOS.broadMatch;
      case NARROW_MATCH -> SKOS.narrowMatch;
      case RELATED_MATCH -> SKOS.relatedMatch;
      case SAME_AS -> OWL2.sameAs;
    };
  }
}
