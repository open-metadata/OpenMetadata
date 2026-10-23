package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.jena.datatypes.RDFDatatype;
import org.apache.jena.datatypes.TypeMapper;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.rdf.OwlEntityDeclarations;

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

  @Override
  protected <R> R executeEntityWrite(
      final List<OntologyProperty> entities, final Supplier<R> work) {
    return super.executeEntityWrite(
        entities,
        () -> {
          workingState.beforeValidation(entityType, this::reconcileInverses);
          return work.get();
        });
  }

  /**
   * A restore brings back the inverse the property held when it was deleted. When that partner
   * has gone since, the link is dropped rather than refused: the property cannot be edited while
   * deleted, so refusing would leave it unrestorable.
   */
  @Override
  public EntityUpdater getUpdater(
      final OntologyProperty original,
      final OntologyProperty updated,
      final Operation operation,
      final ChangeSource source) {
    if (operation.isPut()
        && Boolean.TRUE.equals(original.getDeleted())
        && updated.getInverse() != null
        && Boolean.TRUE.equals(find(original.getId(), Include.ALL).getDeleted())
        && !declaresObjectProperty(
            updated.getOntology().getId(), updated.getInverse().toString())) {
      updated.setInverse(null);
    }
    return super.getUpdater(original, updated, operation, source);
  }

  private boolean declaresObjectProperty(final UUID ontologyId, final String iri) {
    if (OwlEntityDeclarations.vocabularyKind(iri)
        == OwlEntityDeclarations.EntityKind.OBJECT_PROPERTY) {
      return true;
    }
    final var properties = daoCollection.ontologyPropertyDAO();
    return properties
        .findDeclarations(
            properties.getTableName(), ontologyId, List.of(DigestUtils.md5Hex(iri)), 2, "")
        .stream()
        .map(json -> JsonUtils.readValue(json, OntologyProperty.class))
        .anyMatch(property -> property.getKind() == OntologyPropertyKind.OBJECT);
  }

  /**
   * Keeps {@code inverse} an involution over the ontology's live object properties once a
   * mutation's writes are in: the side that states a link decides it, the latest statement wins,
   * and a partner that is no longer pointed back at is released. Partners are written through the
   * updater, so they version, index and validate like any edit.
   */
  private void reconcileInverses(
      final UUID ontologyId, final List<OntologyWorkingModel.Change> changes) {
    final List<InverseAssertion> assertions =
        changes.stream().map(InverseAssertion::of).filter(Objects::nonNull).toList();
    if (assertions.isEmpty()) {
      return;
    }
    final Map<String, OntologyProperty> rows = neighborhood(ontologyId, assertions);
    final InverseLinks links = new InverseLinks(rows);
    String actor = null;
    for (final InverseAssertion assertion : assertions) {
      actor = assertion.actor();
      if (assertion.live()) {
        links.link(assertion.iri(), assertion.inverse());
      } else {
        links.remove(assertion.iri());
      }
    }
    for (final var change : links.changes().entrySet()) {
      linkInverse(rows.get(change.getKey()), change.getValue(), actor);
    }
  }

  /** The live object properties an assertion can touch: its subject, its target, their pointers. */
  private Map<String, OntologyProperty> neighborhood(
      final UUID ontologyId, final List<InverseAssertion> assertions) {
    final Set<String> iris = new HashSet<>();
    for (final InverseAssertion assertion : assertions) {
      iris.add(assertion.iri());
      if (assertion.inverse() != null) {
        iris.add(assertion.inverse());
      }
    }
    final int limit = OntologyReleaseManifest.MAX_MEMBERS + 1;
    final var properties = daoCollection.ontologyPropertyDAO();
    final List<String> declared =
        properties.findDeclarations(
            properties.getTableName(),
            ontologyId,
            iris.stream().map(DigestUtils::md5Hex).toList(),
            limit,
            "FOR UPDATE");
    final List<String> pointing =
        daoCollection
            .ontologyReferenceDAO()
            .incomingInverses(
                ontologyId,
                iris.stream().map(DigestUtils::sha256Hex).toList(),
                limit,
                "FOR UPDATE");
    if (declared.size() >= limit || pointing.size() >= limit) {
      throw new BadRequestException(
          "Ontology validation exceeds the "
              + OntologyReleaseManifest.MAX_MEMBERS
              + " reference limit");
    }
    final Map<String, OntologyProperty> rows = new LinkedHashMap<>();
    for (final String json : declared) {
      final OntologyProperty property = JsonUtils.readValue(json, OntologyProperty.class);
      if (property.getKind() == OntologyPropertyKind.OBJECT) {
        rows.putIfAbsent(property.getIri().toString(), property);
      }
    }
    for (final String json : pointing) {
      final OntologyProperty property = JsonUtils.readValue(json, OntologyProperty.class);
      rows.putIfAbsent(property.getIri().toString(), property);
    }
    return rows;
  }

  private void linkInverse(
      final OntologyProperty stored, final String inverse, final String actor) {
    final OntologyProperty updated =
        JsonUtils.deepCopy(stored, OntologyProperty.class)
            .withInverse(inverse == null ? null : URI.create(inverse));
    updated.setUpdatedBy(actor);
    updated.setUpdatedAt(System.currentTimeMillis());
    prepareInternal(updated, true);
    getUpdater(stored, updated, Operation.PATCH, null).update();
  }

  private static String iriText(final URI iri) {
    return iri == null ? null : iri.toString();
  }

  private static boolean liveObject(final OntologyProperty property) {
    return property != null
        && !Boolean.TRUE.equals(property.getDeleted())
        && property.getKind() == OntologyPropertyKind.OBJECT;
  }

  /**
   * What one write states about a property's inverse: the link it now holds, or that the property
   * no longer takes part. A write that leaves the link as it was, or brings a property to life
   * without one, states nothing.
   */
  private record InverseAssertion(String iri, String inverse, boolean live, String actor) {
    static InverseAssertion of(final OntologyWorkingModel.Change change) {
      final OntologyProperty before =
          change.before() instanceof OntologyProperty property ? property : null;
      final OntologyProperty after =
          change.after() instanceof OntologyProperty property ? property : null;
      final boolean wasLive = liveObject(before);
      final boolean isLive = liveObject(after);
      if ((!wasLive && !isLive)
          || (wasLive
              && isLive
              && Objects.equals(iriText(before.getInverse()), iriText(after.getInverse())))
          || (!wasLive && isLive && after.getInverse() == null)) {
        return null;
      }
      final OntologyProperty subject = after == null ? before : after;
      return new InverseAssertion(
          subject.getIri().toString(),
          isLive ? iriText(after.getInverse()) : null,
          isLive,
          subject.getUpdatedBy());
    }
  }

  /** The inverse links a neighbourhood holds after each assertion is applied in turn. */
  static final class InverseLinks {
    private final Map<String, String> stored = new LinkedHashMap<>();
    private final Map<String, String> links = new LinkedHashMap<>();

    InverseLinks(final Map<String, OntologyProperty> live) {
      live.forEach((iri, property) -> stored.put(iri, iriText(property.getInverse())));
      links.putAll(stored);
    }

    void link(final String iri, final String inverse) {
      point(iri, inverse);
      if (inverse != null && !inverse.equals(iri) && links.containsKey(inverse)) {
        point(inverse, iri);
      }
    }

    void remove(final String iri) {
      release(iri, null);
      links.remove(iri);
    }

    private void point(final String iri, final String inverse) {
      links.put(iri, inverse);
      release(iri, inverse);
    }

    /** Every other property pointing at {@code iri}, except {@code keep}, loses its partner. */
    private void release(final String iri, final String keep) {
      links.replaceAll(
          (other, target) ->
              iri.equals(target) && !other.equals(iri) && !other.equals(keep) ? null : target);
    }

    /** The live properties whose stored inverse differs from the settled one. */
    Map<String, String> changes() {
      final Map<String, String> changed = new LinkedHashMap<>();
      links.forEach(
          (iri, inverse) -> {
            if (stored.containsKey(iri) && !Objects.equals(stored.get(iri), inverse)) {
              changed.put(iri, inverse);
            }
          });
      return changed;
    }
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
