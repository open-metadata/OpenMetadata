package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import org.apache.jena.datatypes.RDFDatatype;
import org.apache.jena.datatypes.TypeMapper;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

@Repository
public class OntologyPropertyRepository extends OntologyEntityRepository<OntologyProperty> {
  public static final String COLLECTION_PATH = "/v1/ontologyProperties/";

  public OntologyPropertyRepository() {
    super(
        Entity.ONTOLOGY_PROPERTY,
        OntologyProperty.class,
        Entity.getCollectionDAO().ontologyPropertyDAO(),
        COLLECTION_PATH,
        "ontology,iri,kind,domain,range,enumValues,unit,isIdentifier,inverse,characteristics,propertyChain,disjointWith");
  }

  @Override
  protected void validateDefinition(final OntologyProperty entity) {
    if (entity.getKind() == null) {
      throw new BadRequestException("Ontology property kind is required");
    }
    validateDistinctIris(entity.getDomain(), "domain");
    validateDistinctIris(entity.getRange(), "range");
    validateIris(entity.getPropertyChain(), "propertyChain");
    validateDistinctIris(entity.getDisjointWith(), "disjointWith");
    if (entity.getInverse() != null) {
      requireAbsoluteIri(entity.getInverse(), "inverse");
    }
    validatePropertyKind(entity);
    validateDataMetadata(entity);
  }

  private static void validateDataMetadata(final OntologyProperty entity) {
    final List<OntologyLiteral> values = entity.getEnumValues();
    if (entity.getKind() != OntologyPropertyKind.DATA
        && (!nullOrEmpty(values)
            || entity.getUnit() != null
            || Boolean.TRUE.equals(entity.getIsIdentifier()))) {
      throw new BadRequestException(
          "Only data properties can define enum values, units or identifier intent");
    }
    if (entity.getUnit() != null
        && (entity.getUnit().isBlank() || entity.getUnit().length() > 256)) {
      throw new BadRequestException("An ontology property unit requires 1 to 256 characters");
    }
    validateEnumValues(values);
  }

  private static void validateEnumValues(final List<OntologyLiteral> values) {
    if (values != null) {
      if (values.size() > 1000) {
        throw new BadRequestException("An ontology property supports at most 1000 enum values");
      }
      values.forEach(OntologyPropertyRepository::validateLiteral);
      if (values.stream().map(JsonUtils::pojoToJson).distinct().count() != values.size()) {
        throw new BadRequestException("Ontology property enum values must be unique");
      }
    }
  }

  private static void validateLiteral(final OntologyLiteral literal) {
    if (literal == null || literal.getValue() == null) {
      throw new BadRequestException("An ontology enum literal requires a value");
    }
    if (literal.getDatatypeIri() != null) {
      requireAbsoluteIri(literal.getDatatypeIri(), "enum datatype");
      final RDFDatatype datatype =
          TypeMapper.getInstance().getTypeByName(literal.getDatatypeIri().toString());
      if (datatype != null && !datatype.isValid(literal.getValue())) {
        throw new BadRequestException("An ontology enum value is invalid for its datatype");
      }
    }
  }

  private static void validatePropertyKind(final OntologyProperty entity) {
    if (entity.getKind() != OntologyPropertyKind.OBJECT
        && (entity.getInverse() != null || !nullOrEmpty(entity.getPropertyChain()))) {
      throw new BadRequestException("Only object properties can have inverses or property chains");
    }
    if (!nullOrEmpty(entity.getPropertyChain()) && entity.getPropertyChain().size() < 2) {
      throw new BadRequestException("A property chain requires at least two object properties");
    }
    validateCharacteristics(entity);
    if (entity.getKind() == OntologyPropertyKind.ANNOTATION
        && !nullOrEmpty(entity.getDisjointWith())) {
      throw new BadRequestException("Annotation properties cannot declare disjointness");
    }
  }

  private static void validateCharacteristics(final OntologyProperty entity) {
    final EnumSet<RelationshipCharacteristic> allowed =
        switch (entity.getKind()) {
          case OBJECT -> EnumSet.allOf(RelationshipCharacteristic.class);
          case DATA -> EnumSet.of(RelationshipCharacteristic.FUNCTIONAL);
          case ANNOTATION -> EnumSet.noneOf(RelationshipCharacteristic.class);
        };
    if (!nullOrEmpty(entity.getCharacteristics())
        && !allowed.containsAll(entity.getCharacteristics())) {
      throw new BadRequestException(
          "Unsupported characteristics for " + entity.getKind() + " property");
    }
  }

  private static void validateIris(final Collection<URI> iris, final String field) {
    if (!nullOrEmpty(iris)) {
      iris.forEach(iri -> requireAbsoluteIri(iri, field));
    }
  }

  private static void validateDistinctIris(final Collection<URI> iris, final String field) {
    validateIris(iris, field);
    if (!nullOrEmpty(iris) && iris.stream().map(URI::toString).distinct().count() != iris.size()) {
      throw new BadRequestException(field + " requires unique IRIs");
    }
  }
}
