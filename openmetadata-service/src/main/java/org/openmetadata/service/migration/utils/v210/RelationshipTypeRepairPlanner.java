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

package org.openmetadata.service.migration.utils.v210;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.net.URI;
import java.net.URLEncoder;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.RelationshipTypeIds;
import org.openmetadata.service.ontology.RelationshipTypeReferences;
import org.openmetadata.service.ontology.RelationshipTypeReferences.Reference;

/**
 * Plans the repair of relationship types that were deleted while still in use. Every type another
 * type references by id, and every type a stored glossary term relation names, must be live: a
 * soft-deleted one is undeleted, and a hard-deleted one is recreated under its old id and name as a
 * deprecated placeholder, so nothing a user stored is dropped or reinterpreted
 * (ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted).
 */
final class RelationshipTypeRepairPlanner {
  static final String PREDICATE_BASE = "https://open-metadata.org/ontology/";
  static final int MAX_DESCRIBED_REFERRERS = 10;

  /** A relationship type as stored relation rows name it; either part may be missing. */
  record StoredRelationType(UUID id, String name) {}

  record Plan(
      List<RelationshipType> restored, List<RelationshipType> recreated, List<String> unresolved) {
    boolean isEmpty() {
      return restored.isEmpty() && recreated.isEmpty();
    }
  }

  private record Demand(UUID id, String name, String referrer) {}

  private final List<RelationshipType> types;
  private final Clock clock;

  RelationshipTypeRepairPlanner(final List<RelationshipType> types, final Clock clock) {
    this.types = List.copyOf(types);
    this.clock = clock;
  }

  /**
   * Demands start from live types and stored relations; a type this undeletes adds its own
   * references, until nothing new comes back. A soft-deleted type only another soft-deleted type
   * references stays deleted: nothing reads through it.
   */
  Plan plan(final List<StoredRelationType> storedRelationTypes) {
    final List<RelationshipType> restored = new ArrayList<>();
    final List<RelationshipType> recreated = new ArrayList<>();
    final List<String> unresolved = new ArrayList<>();
    List<Demand> pending =
        Stream.concat(referenceDemands(live(types)), relationDemands(storedRelationTypes)).toList();
    while (!pending.isEmpty()) {
      final int restoredBefore = restored.size();
      byTarget(pending)
          .values()
          .forEach(demands -> resolve(demands, restored, recreated, unresolved));
      pending =
          referenceDemands(restored.subList(restoredBefore, restored.size()).stream()).toList();
    }
    linkPlaceholderInverses(recreated, restored);
    return new Plan(
        List.copyOf(restored), List.copyOf(recreated), unresolved.stream().distinct().toList());
  }

  private static Stream<RelationshipType> live(final List<RelationshipType> types) {
    return types.stream().filter(type -> !Boolean.TRUE.equals(type.getDeleted()));
  }

  private static Map<String, List<Demand>> byTarget(final List<Demand> demands) {
    return demands.stream()
        .collect(
            Collectors.groupingBy(
                RelationshipTypeRepairPlanner::targetKey, LinkedHashMap::new, Collectors.toList()));
  }

  /**
   * A reference without an id was written by FQN before its target existed; nothing proves the
   * target ever existed, so it is not recreated (the ontology export omits it instead).
   */
  private static Stream<Demand> referenceDemands(final Stream<RelationshipType> owners) {
    return owners
        .flatMap(type -> RelationshipTypeReferences.heldBy(type).stream())
        .filter(reference -> reference.target().getId() != null)
        .map(RelationshipTypeRepairPlanner::demand);
  }

  private static Demand demand(final Reference reference) {
    final EntityReference target = reference.target();
    final String name =
        target.getName() != null ? target.getName() : target.getFullyQualifiedName();
    return new Demand(
        target.getId(),
        name,
        "relationship type '"
            + reference.owner().getName()
            + "' ("
            + reference.field().jsonName()
            + ")");
  }

  private static Stream<Demand> relationDemands(final List<StoredRelationType> stored) {
    return stored.stream()
        .map(relationType -> new Demand(relationType.id(), relationType.name(), "glossary terms"));
  }

  private static String targetKey(final Demand demand) {
    return demand.name() != null ? "name:" + demand.name() : "id:" + demand.id();
  }

  private void resolve(
      final List<Demand> demands,
      final List<RelationshipType> restored,
      final List<RelationshipType> recreated,
      final List<String> unresolved) {
    final Demand first = demands.getFirst();
    final Optional<RelationshipType> existing = find(first, recreated);
    if (existing.isPresent()) {
      restoreIfDeleted(existing.get(), restored);
    } else if (first.name() == null) {
      unresolved.add("relationship type " + first.id() + " used by " + referrers(demands));
    } else {
      recreated.add(placeholder(demands, recreated));
    }
  }

  private Optional<RelationshipType> find(
      final Demand demand, final List<RelationshipType> recreated) {
    final List<RelationshipType> known = Stream.concat(recreated.stream(), types.stream()).toList();
    final Optional<RelationshipType> byName =
        known.stream().filter(type -> Objects.equals(type.getName(), demand.name())).findFirst();
    return byName.or(
        () -> known.stream().filter(type -> Objects.equals(type.getId(), demand.id())).findFirst());
  }

  private void restoreIfDeleted(
      final RelationshipType type, final List<RelationshipType> restored) {
    final boolean isPlanned =
        restored.stream().anyMatch(planned -> planned.getId().equals(type.getId()));
    if (Boolean.TRUE.equals(type.getDeleted()) && !isPlanned) {
      restored.add(
          copy(type)
              .withDeleted(false)
              .withUpdatedAt(clock.millis())
              .withUpdatedBy(ADMIN_USER_NAME));
    }
  }

  private RelationshipType placeholder(
      final List<Demand> demands, final List<RelationshipType> recreated) {
    final String name = demands.getFirst().name();
    final UUID id =
        demands.stream()
            .map(Demand::id)
            .filter(Objects::nonNull)
            .findFirst()
            .orElseGet(() -> RelationshipTypeIds.stableId(name));
    final URI predicate = unusedPredicate(name, id, recreated);
    return new RelationshipType()
        .withId(id)
        .withName(name)
        .withFullyQualifiedName(name)
        .withDisplayName(name)
        .withDescription(placeholderDescription(demands))
        .withIri(predicate)
        .withRdfPredicate(predicate)
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withDomain(Set.of())
        .withRange(Set.of())
        .withCharacteristics(Set.of())
        .withPropertyChain(List.of())
        .withDisjointWith(Set.of())
        .withCrossGlossaryAllowed(true)
        .withPaletteKey(RelationshipPaletteKey.GRAY)
        .withSystemDefined(false)
        .withEntityStatus(EntityStatus.DEPRECATED)
        .withProvider(ProviderType.USER)
        .withVersion(0.1)
        .withUpdatedAt(clock.millis())
        .withUpdatedBy(ADMIN_USER_NAME)
        .withDeleted(false);
  }

  private static String placeholderDescription(final List<Demand> demands) {
    return "Recreated by the 2.1.0 upgrade: this relationship type had been deleted while "
        + referrers(demands)
        + " still used it. Its original definition was not kept. Remove those uses, then delete"
        + " this type.";
  }

  private static String referrers(final List<Demand> demands) {
    final List<String> referrers = demands.stream().map(Demand::referrer).distinct().toList();
    final String listed =
        String.join(
            ", ", referrers.subList(0, Math.min(referrers.size(), MAX_DESCRIBED_REFERRERS)));
    return referrers.size() > MAX_DESCRIBED_REFERRERS
        ? listed + " and " + (referrers.size() - MAX_DESCRIBED_REFERRERS) + " more"
        : listed;
  }

  private URI unusedPredicate(
      final String name, final UUID id, final List<RelationshipType> recreated) {
    final Set<URI> taken =
        Stream.concat(types.stream(), recreated.stream())
            .map(RelationshipType::getRdfPredicate)
            .filter(Objects::nonNull)
            .collect(Collectors.toUnmodifiableSet());
    final URI byName = URI.create(PREDICATE_BASE + URLEncoder.encode(name, UTF_8));
    return taken.contains(byName) ? URI.create(PREDICATE_BASE + "relationshipType/" + id) : byName;
  }

  /**
   * Relations authored as {@code A} from the higher id are stored as {@code inverse(A)}; pointing a
   * recreated inverse back at {@code A} keeps those relations reading as authored from both ends.
   * The back-link copies the shape of {@code A}'s own reference: relation reads follow an inverse
   * only through its name, so a nameless one, as REST writes it, must stay nameless.
   */
  private void linkPlaceholderInverses(
      final List<RelationshipType> recreated, final List<RelationshipType> restored) {
    final List<RelationshipType> partners =
        Stream.concat(live(types), restored.stream())
            .filter(type -> type.getInverse() != null)
            .sorted(Comparator.comparing(RelationshipType::getName))
            .toList();
    for (final RelationshipType placeholder : recreated) {
      partners.stream()
          .filter(type -> RelationshipTypeReferences.names(type.getInverse(), placeholder))
          .findFirst()
          .ifPresent(
              partner ->
                  placeholder.setInverse(
                      reference(partner, partner.getInverse().getName() != null)));
    }
  }

  private static EntityReference reference(final RelationshipType type, final boolean isNamed) {
    return new EntityReference()
        .withId(type.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withName(isNamed ? type.getName() : null)
        .withFullyQualifiedName(type.getFullyQualifiedName());
  }

  private static RelationshipType copy(final RelationshipType type) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(type), RelationshipType.class);
  }
}
