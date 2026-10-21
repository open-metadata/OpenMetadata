package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;

final class OntologyPropertyRdfWriter {
  private OntologyPropertyRdfWriter() {}

  static Resource write(
      final Model model, final OntologyProperty definition, final String enumIri) {
    final OntologyPropertyKind kind = definition.getKind();
    final Resource property = model.createResource(definition.getIri().toString());
    final Resource declaration =
        switch (kind) {
          case OBJECT -> OWL2.ObjectProperty;
          case DATA -> OWL2.DatatypeProperty;
          case ANNOTATION -> OWL2.AnnotationProperty;
        };
    property.addProperty(RDF.type, declaration);
    listOrEmpty(definition.getDomain())
        .forEach(
            iri ->
                property.addProperty(
                    RDFS.domain,
                    reference(
                        model,
                        iri,
                        kind == OntologyPropertyKind.ANNOTATION ? null : EntityKind.CLASS)));
    listOrEmpty(definition.getRange())
        .forEach(iri -> property.addProperty(RDFS.range, reference(model, iri, rangeKind(kind))));
    if (!nullOrEmpty(definition.getCharacteristics())) {
      definition
          .getCharacteristics()
          .forEach(
              characteristic ->
                  property.addProperty(
                      RDF.type, OntologyRdfVocabulary.characteristic(characteristic)));
    }
    if (definition.getInverse() != null) {
      property.addProperty(
          OWL2.inverseOf, reference(model, definition.getInverse(), EntityKind.OBJECT_PROPERTY));
    }
    listOrEmpty(definition.getDisjointWith())
        .forEach(
            iri ->
                property.addProperty(
                    OWL2.propertyDisjointWith,
                    reference(
                        model,
                        iri,
                        kind == OntologyPropertyKind.DATA
                            ? EntityKind.DATA_PROPERTY
                            : EntityKind.OBJECT_PROPERTY)));
    if (!nullOrEmpty(definition.getPropertyChain())) {
      property.addProperty(
          OWL2.propertyChainAxiom,
          model.createList(
              definition.getPropertyChain().stream()
                  .map(iri -> (RDFNode) reference(model, iri, EntityKind.OBJECT_PROPERTY))
                  .iterator()));
    }
    writeDataMetadata(model, property, definition, enumIri);
    return property;
  }

  private static void writeDataMetadata(
      final Model model,
      final Resource property,
      final OntologyProperty definition,
      final String enumIri) {
    if (!nullOrEmpty(definition.getEnumValues())) {
      final Resource range =
          model
              .createResource()
              .addProperty(RDF.type, RDFS.Datatype)
              .addProperty(
                  OWL2.oneOf,
                  model.createList(
                      definition.getEnumValues().stream()
                          .map(value -> enumLiteral(model, value))
                          .iterator()));
      // OWL API 5.5.1 consumes an anonymous data range twice when its range axiom is annotated.
      final Resource datatype =
          model
              .createResource(enumIri)
              .addProperty(RDF.type, RDFS.Datatype)
              .addProperty(OWL2.equivalentClass, range);
      property.addProperty(RDFS.range, datatype);
    }
    if (definition.getUnit() != null) {
      OwlEntityDeclarations.declare(
          model, OntologyRdfVocabulary.UNIT, EntityKind.ANNOTATION_PROPERTY);
      property.addProperty(OntologyRdfVocabulary.UNIT, definition.getUnit());
    }
    if (Boolean.TRUE.equals(definition.getIsIdentifier())) {
      OwlEntityDeclarations.declare(
          model, OntologyRdfVocabulary.IDENTIFIER_INTENT, EntityKind.ANNOTATION_PROPERTY);
      property.addLiteral(OntologyRdfVocabulary.IDENTIFIER_INTENT, true);
    }
  }

  private static RDFNode enumLiteral(final Model model, final OntologyLiteral value) {
    if (value.getDatatypeIri() != null) {
      reference(model, value.getDatatypeIri(), EntityKind.DATATYPE);
    }
    return OntologyExpressionRdfWriter.literal(model, value);
  }

  private static EntityKind rangeKind(final OntologyPropertyKind kind) {
    return switch (kind) {
      case OBJECT -> EntityKind.CLASS;
      case DATA -> EntityKind.DATATYPE;
      case ANNOTATION -> null;
    };
  }

  private static Resource reference(final Model model, final URI iri, final EntityKind kind) {
    final Resource resource = model.createResource(iri.toString());
    if (kind != null) {
      OwlEntityDeclarations.declare(model, resource, kind);
    }
    return resource;
  }
}
