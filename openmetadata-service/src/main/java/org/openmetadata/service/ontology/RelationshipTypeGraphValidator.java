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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.service.rdf.OwlEntityDeclarations;

/**
 * Checks a relationship type against the types it names and the types that name it. Besides chain
 * regularity, it enforces what OWL 2 DL requires of the property axioms the type projects to:
 *
 * <ul>
 *   <li>A property chain or property disjointness never names a reserved predicate (RDF, RDFS,
 *       OWL, XSD or SKOS vocabulary), on either side: OWL 2 DL forbids such axioms on built-in
 *       vocabulary, and a SKOS predicate keeps its SKOS meaning. Characteristics on a reserved
 *       type stay as navigation hints and are not projected.
 *   <li>A non-simple type, one that is transitive, is defined by a property chain, or is the
 *       inverse of such a type, is never functional, inverse-functional, irreflexive, asymmetric
 *       or disjoint with another type (the OWL 2 DL global restrictions on simple roles).
 * </ul>
 *
 * <p>See ADR:2026-10-14-relationship-types-reject-axioms-owl2-dl-cannot-express.
 */
public final class RelationshipTypeGraphValidator {
  private static final Set<RelationshipCharacteristic> SIMPLE_ONLY_CHARACTERISTICS =
      Set.of(
          RelationshipCharacteristic.FUNCTIONAL,
          RelationshipCharacteristic.INVERSE_FUNCTIONAL,
          RelationshipCharacteristic.IRREFLEXIVE,
          RelationshipCharacteristic.ASYMMETRIC);
  private final Function<UUID, RelationshipType> typeLookup;
  private final Supplier<List<RelationshipType>> allTypes;

  public RelationshipTypeGraphValidator(final Function<UUID, RelationshipType> typeLookup) {
    this(typeLookup, List::of);
  }

  /**
   * @param allTypes every stored type, read only when the candidate could invalidate a type that
   *     names it
   */
  public RelationshipTypeGraphValidator(
      final Function<UUID, RelationshipType> typeLookup,
      final Supplier<List<RelationshipType>> allTypes) {
    this.typeLookup = typeLookup;
    this.allTypes = allTypes;
  }

  public void validate(final RelationshipType relationshipType) {
    validateDisjointReferences(relationshipType);
    validatePropertyChain(relationshipType);
    rejectDependencyCycle(relationshipType);
    rejectReservedPredicates(relationshipType);
    rejectNonSimpleRestrictions(relationshipType);
    rejectInvalidatedReferrers(relationshipType);
  }

  private void rejectReservedPredicates(final RelationshipType candidate) {
    final boolean hasChain = !listOrEmpty(candidate.getPropertyChain()).isEmpty();
    final boolean hasDisjointness = !setOrEmpty(candidate.getDisjointWith()).isEmpty();
    if (isReserved(candidate) && (hasChain || hasDisjointness)) {
      throw new BadRequestException(
          String.format(
              "Relationship type '%s' uses reserved predicate <%s>, which cannot have a property"
                  + " chain or property disjointness in OWL 2 DL",
              candidate.getName(), candidate.getRdfPredicate()));
    }
    for (final EntityReference member : listOrEmpty(candidate.getPropertyChain())) {
      rejectReservedReference(candidate, resolve(member.getId(), candidate), "property chain");
    }
    for (final EntityReference disjoint : setOrEmpty(candidate.getDisjointWith())) {
      rejectReservedReference(candidate, resolve(disjoint.getId(), candidate), "disjointWith");
    }
  }

  private static void rejectReservedReference(
      final RelationshipType candidate, final RelationshipType named, final String field) {
    if (isReserved(named)) {
      throw new BadRequestException(
          String.format(
              "Relationship type '%s' names '%s' in its %s, but its predicate <%s> is reserved"
                  + " vocabulary that OWL 2 DL cannot use there",
              candidate.getName(), named.getName(), field, named.getRdfPredicate()));
    }
  }

  private void rejectNonSimpleRestrictions(final RelationshipType candidate) {
    if (isNonSimple(candidate, candidate)) {
      final Set<RelationshipCharacteristic> forbidden =
          setOrEmpty(candidate.getCharacteristics()).stream()
              .filter(SIMPLE_ONLY_CHARACTERISTICS::contains)
              .collect(Collectors.toCollection(TreeSet::new));
      if (!forbidden.isEmpty()) {
        throw new BadRequestException(
            String.format(
                "Relationship type '%s' is not simple (%s), so OWL 2 DL forbids it to be %s",
                candidate.getName(), nonSimpleReason(candidate, candidate), forbidden));
      }
      if (!setOrEmpty(candidate.getDisjointWith()).isEmpty()) {
        throw new BadRequestException(
            String.format(
                "Relationship type '%s' is not simple (%s), so OWL 2 DL forbids it in property"
                    + " disjointness",
                candidate.getName(), nonSimpleReason(candidate, candidate)));
      }
    }
    for (final EntityReference disjoint : setOrEmpty(candidate.getDisjointWith())) {
      final RelationshipType named = resolve(disjoint.getId(), candidate);
      if (isNonSimple(named, candidate)) {
        throw new BadRequestException(
            String.format(
                "Relationship type '%s' cannot be disjoint with '%s': '%s' is not simple (%s)",
                candidate.getName(),
                named.getName(),
                named.getName(),
                nonSimpleReason(named, candidate)));
      }
    }
  }

  /**
   * A change to the candidate can break a type that names it: a type disjoint with it, a type that
   * is its inverse, or a chain or disjointness that names its predicate once it becomes reserved.
   */
  private void rejectInvalidatedReferrers(final RelationshipType candidate) {
    if (!isReserved(candidate) && !isNonSimple(candidate, candidate)) {
      return;
    }
    for (final RelationshipType other : allTypes.get()) {
      if (!other.getId().equals(candidate.getId())) {
        rejectInvalidatedReferrer(candidate, other);
      }
    }
  }

  private void rejectInvalidatedReferrer(
      final RelationshipType candidate, final RelationshipType other) {
    final boolean namesInChain = names(listOrEmpty(other.getPropertyChain()), candidate);
    final boolean namesAsDisjoint = names(setOrEmpty(other.getDisjointWith()), candidate);
    if (isReserved(candidate) && (namesInChain || namesAsDisjoint)) {
      throw new BadRequestException(
          String.format(
              "Relationship type '%s' cannot use reserved predicate <%s>: '%s' names it in a"
                  + " property chain or property disjointness",
              candidate.getName(), candidate.getRdfPredicate(), other.getName()));
    }
    if (isNonSimple(candidate, candidate) && !isReserved(candidate)) {
      final boolean isInverse =
          other.getInverse() != null && candidate.getId().equals(other.getInverse().getId());
      final boolean hasForbidden =
          setOrEmpty(other.getCharacteristics()).stream()
              .anyMatch(SIMPLE_ONLY_CHARACTERISTICS::contains);
      if (namesAsDisjoint || (isInverse && hasForbidden && !isReserved(other))) {
        throw new BadRequestException(
            String.format(
                "Relationship type '%s' cannot become non-simple (%s): '%s' %s it",
                candidate.getName(),
                nonSimpleReason(candidate, candidate),
                other.getName(),
                namesAsDisjoint
                    ? "is disjoint with"
                    : "is functional, inverse-functional, irreflexive or asymmetric and the"
                        + " inverse of"));
      }
    }
  }

  private static boolean names(
      final Collection<EntityReference> references, final RelationshipType type) {
    return references.stream().anyMatch(reference -> type.getId().equals(reference.getId()));
  }

  /**
   * Transitive, defined by a chain, or the inverse of such a type. A reserved type's
   * characteristics, chain and inverse are not projected, so they never make a type non-simple.
   */
  private boolean isNonSimple(final RelationshipType type, final RelationshipType candidate) {
    return nonSimpleReason(type, candidate) != null;
  }

  private String nonSimpleReason(final RelationshipType type, final RelationshipType candidate) {
    String reason = isReserved(type) ? null : ownNonSimpleReason(type);
    if (reason == null && !isReserved(type) && type.getInverse() != null) {
      final UUID inverseId = type.getInverse().getId();
      final RelationshipType inverse =
          inverseId == null || inverseId.equals(type.getId())
              ? null
              : resolveOrNull(inverseId, candidate);
      final String inverseReason =
          inverse == null || isReserved(inverse) ? null : ownNonSimpleReason(inverse);
      reason =
          inverseReason == null
              ? null
              : "its inverse '" + inverse.getName() + "' is " + inverseReason;
    }
    return reason;
  }

  private static String ownNonSimpleReason(final RelationshipType type) {
    final String reason;
    if (setOrEmpty(type.getCharacteristics()).contains(RelationshipCharacteristic.TRANSITIVE)) {
      reason = "transitive";
    } else if (!listOrEmpty(type.getPropertyChain()).isEmpty()) {
      reason = "defined by a property chain";
    } else {
      reason = null;
    }
    return reason;
  }

  private RelationshipType resolveOrNull(final UUID id, final RelationshipType candidate) {
    return candidate.getId().equals(id) ? candidate : typeLookup.apply(id);
  }

  private static boolean isReserved(final RelationshipType type) {
    return type.getRdfPredicate() != null
        && OwlEntityDeclarations.isReservedVocabulary(type.getRdfPredicate().toString());
  }

  private static void validateDisjointReferences(final RelationshipType relationshipType) {
    for (final EntityReference reference : setOrEmpty(relationshipType.getDisjointWith())) {
      requireReference(reference, "disjointWith");
      if (relationshipType.getId().equals(reference.getId())) {
        throw new BadRequestException("A relationship type cannot be disjoint with itself");
      }
    }
  }

  private static void validatePropertyChain(final RelationshipType relationshipType) {
    final List<EntityReference> chain = listOrEmpty(relationshipType.getPropertyChain());
    if (!chain.isEmpty() && chain.size() < 2) {
      throw new BadRequestException("A relationship property chain requires at least two members");
    }
    chain.forEach(reference -> requireReference(reference, "propertyChain"));
    validateDirectSelfReference(relationshipType, chain);
  }

  private static void validateDirectSelfReference(
      final RelationshipType relationshipType, final List<EntityReference> chain) {
    final long selfReferences =
        chain.stream()
            .filter(reference -> relationshipType.getId().equals(reference.getId()))
            .count();
    final boolean isTransitiveChain =
        selfReferences == 2
            && chain.size() == 2
            && relationshipType
                .getCharacteristics()
                .contains(RelationshipCharacteristic.TRANSITIVE);
    if (selfReferences > 0 && !isTransitiveChain) {
      throw new BadRequestException(
          "A property chain can reference itself only as a two-member transitive chain");
    }
  }

  private void rejectDependencyCycle(final RelationshipType candidate) {
    final Set<UUID> visiting = new HashSet<>();
    final Set<UUID> visited = new HashSet<>();
    if (hasCycle(candidate, candidate, visiting, visited)) {
      throw new BadRequestException(
          "Property chain for relationship type '" + candidate.getName() + "' is not regular");
    }
  }

  private boolean hasCycle(
      final RelationshipType current,
      final RelationshipType candidate,
      final Set<UUID> visiting,
      final Set<UUID> visited) {
    final UUID currentId = current.getId();
    final boolean hasCycle;
    if (visited.contains(currentId)) {
      hasCycle = false;
    } else if (!visiting.add(currentId)) {
      hasCycle = true;
    } else {
      hasCycle = hasCyclicMember(current, candidate, visiting, visited);
      visiting.remove(currentId);
      visited.add(currentId);
    }
    return hasCycle;
  }

  private boolean hasCyclicMember(
      final RelationshipType current,
      final RelationshipType candidate,
      final Set<UUID> visiting,
      final Set<UUID> visited) {
    boolean hasCycle = false;
    for (final EntityReference member : listOrEmpty(current.getPropertyChain())) {
      if (!isAllowedTransitiveSelfChain(current, member)) {
        final RelationshipType dependency = resolve(member.getId(), candidate);
        hasCycle = hasCycle(dependency, candidate, visiting, visited);
      }
      if (hasCycle) {
        break;
      }
    }
    return hasCycle;
  }

  private RelationshipType resolve(final UUID id, final RelationshipType candidate) {
    final RelationshipType relationshipType =
        candidate.getId().equals(id) ? candidate : typeLookup.apply(id);
    if (relationshipType == null) {
      throw new BadRequestException(
          "Property chain references unknown relationship type '" + id + "'");
    }
    return relationshipType;
  }

  private static boolean isAllowedTransitiveSelfChain(
      final RelationshipType relationshipType, final EntityReference member) {
    final List<EntityReference> chain = listOrEmpty(relationshipType.getPropertyChain());
    return relationshipType.getId().equals(member.getId())
        && chain.size() == 2
        && relationshipType.getCharacteristics().contains(RelationshipCharacteristic.TRANSITIVE);
  }

  private static void requireReference(final EntityReference reference, final String field) {
    if (reference == null || reference.getId() == null) {
      throw new BadRequestException(
          "Every " + field + " entry must resolve to a relationship type");
    }
  }

  private static <T> Set<T> setOrEmpty(final Set<T> values) {
    final Set<T> safeValues = values == null ? Set.of() : values;
    return safeValues;
  }
}
