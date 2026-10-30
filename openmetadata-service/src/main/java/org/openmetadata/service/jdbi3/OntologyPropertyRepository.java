package org.openmetadata.service.jdbi3;

import java.net.URI;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyPropertyRules;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.rdf.OwlEntityDeclarations;
import org.openmetadata.service.util.FullyQualifiedName;

@Repository
public class OntologyPropertyRepository extends OntologyEntityRepository<OntologyProperty> {
  public static final String COLLECTION_PATH = "/v1/ontologyProperties/";

  /**
   * The deleted object properties the write in progress holds, by declaration. When that write is
   * a restore, it brings every one of them back, as restoring an ontology does with all its
   * properties at once.
   */
  private static final ThreadLocal<Restoring> RESTORING =
      ThreadLocal.withInitial(() -> Restoring.NONE);

  private record Declaration(UUID ontologyId, String iri) {
    static Declaration of(final OntologyProperty property, final URI iri) {
      return new Declaration(property.getOntology().getId(), iri.toString());
    }
  }

  /** A write's deleted object properties, and the partners that two or more of them name. */
  private record Restoring(
      Map<Declaration, OntologyProperty> properties, Set<Declaration> contested) {
    static final Restoring NONE = new Restoring(Map.of(), Set.of());

    static Restoring of(final List<OntologyProperty> entities) {
      final Map<Declaration, OntologyProperty> properties =
          entities.stream()
              .filter(
                  property ->
                      Boolean.TRUE.equals(property.getDeleted())
                          && property.getKind() == OntologyPropertyKind.OBJECT)
              .collect(
                  Collectors.toUnmodifiableMap(
                      property -> Declaration.of(property, property.getIri()),
                      property -> property,
                      (first, second) -> first));
      return new Restoring(properties, contested(properties.values()));
    }

    private static Set<Declaration> contested(final Collection<OntologyProperty> properties) {
      return properties.stream()
          .filter(property -> property.getInverse() != null)
          .collect(
              Collectors.groupingBy(
                  property -> Declaration.of(property, property.getInverse()),
                  Collectors.counting()))
          .entrySet()
          .stream()
          .filter(claims -> claims.getValue() > 1)
          .map(Map.Entry::getKey)
          .collect(Collectors.toUnmodifiableSet());
    }
  }

  public OntologyPropertyRepository() {
    super(
        Entity.ONTOLOGY_PROPERTY,
        OntologyProperty.class,
        Entity.getCollectionDAO().ontologyPropertyDAO(),
        COLLECTION_PATH,
        "ontology,iri,kind,domain,range,enumValues,unit,isIdentifier,inverse,characteristics,propertyChain,disjointWith,deprecated,replacedBy");
  }

  @Override
  protected void validateDefinition(final OntologyProperty entity) {
    final OntologyPropertyRules.Violation violation =
        OntologyPropertyRules.firstViolation(entity, () -> storedEnumerationEquals(entity));
    if (violation != null) {
      throw new BadRequestException(violation.message());
    }
  }

  private boolean storedEnumerationEquals(final OntologyProperty entity) {
    final OntologyProperty stored =
        findByNameOrNull(
            FullyQualifiedName.add(entity.getOntology().getFullyQualifiedName(), entity.getName()),
            Include.ALL);
    return stored != null
        && JsonUtils.pojoToJson(stored.getEnumValues())
            .equals(JsonUtils.pojoToJson(entity.getEnumValues()));
  }

  @Override
  protected <R> R executeEntityWrite(
      final List<OntologyProperty> entities, final Supplier<R> work) {
    return super.executeEntityWrite(
        entities,
        () -> {
          workingState.beforeValidation(entityType, this::reconcileInverses);
          final Restoring enclosing = RESTORING.get();
          RESTORING.set(Restoring.of(entities));
          try {
            return work.get();
          } finally {
            RESTORING.set(enclosing);
          }
        });
  }

  @Override
  protected void preDelete(final OntologyProperty property, final String deletedBy) {
    // A hard delete leaves only the stored preimage, which still names its previous writer.
    // Release partners while the delete actor is available, inside the retained transaction.
    final OntologyProperty deleted =
        JsonUtils.deepCopy(property, OntologyProperty.class)
            .withDeleted(true)
            .withUpdatedBy(deletedBy);
    reconcileInverses(
        property.getOntology().getId(),
        List.of(new OntologyWorkingModel.Change(property, deleted)));
  }

  /**
   * A restore brings back the inverse the property held when it was deleted. When that partner
   * has gone since and does not return in the same write, the link is dropped rather than
   * refused: the property cannot be edited while deleted, so refusing would leave it unrestorable.
   * When the partner returns in the same write, the link is kept only if the partner still names
   * this property. A property deleted on its own keeps a claim that its partner has since released
   * or given to another property, and the partner's own inverse is the later statement. When the
   * partner is live and another property the same write restores names it too, all of those links
   * are dropped and the partner keeps its inverse, because the rows of one write have no order
   * that makes one claim the latest. Links to a vocabulary property that the ontology does not
   * declare never compete, since no write changes that property. A self-inverse is kept, because
   * its own declaration goes live in this write.
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
        && !updated.getInverse().equals(updated.getIri())
        && Boolean.TRUE.equals(find(original.getId(), Include.ALL).getDeleted())
        && !partnerLinksBack(updated)) {
      updated.setInverse(null);
    }
    return super.getUpdater(original, updated, operation, source);
  }

  private boolean partnerLinksBack(final OntologyProperty property) {
    final Declaration partner = Declaration.of(property, property.getInverse());
    final OntologyProperty restored = RESTORING.get().properties().get(partner);
    return restored == null
        ? isLiveAndUncontested(partner)
        : property.getIri().toString().equals(iriText(restored.getInverse()));
  }

  private boolean isLiveAndUncontested(final Declaration partner) {
    return declaresObjectProperty(partner.ontologyId(), partner.iri())
        ? !RESTORING.get().contested().contains(partner)
        : OwlEntityDeclarations.vocabularyKind(partner.iri())
            == OwlEntityDeclarations.EntityKind.OBJECT_PROPERTY;
  }

  private boolean declaresObjectProperty(final UUID ontologyId, final String iri) {
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
}
