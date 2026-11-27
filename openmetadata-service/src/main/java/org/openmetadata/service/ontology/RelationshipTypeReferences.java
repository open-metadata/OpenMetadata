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

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The references one relationship type holds to others: {@code inverse}, {@code replacedBy}, each
 * {@code propertyChain} member and each {@code disjointWith} member. Readers resolve every one of
 * them against live types, so a type another type references must not disappear
 * (ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted).
 */
public final class RelationshipTypeReferences {
  static final int MAX_LISTED_REFERRERS = 10;

  public enum Field {
    INVERSE("inverse"),
    REPLACED_BY("replacedBy"),
    PROPERTY_CHAIN("propertyChain"),
    DISJOINT_WITH("disjointWith");

    private final String jsonName;

    Field(final String jsonName) {
      this.jsonName = jsonName;
    }

    public String jsonName() {
      return jsonName;
    }
  }

  /** One reference held by {@code owner}. */
  public record Reference(RelationshipType owner, Field field, EntityReference target) {
    /**
     * Another type naming the target as its inverse: the one reference a delete of the target
     * clears instead of refusing.
     */
    public boolean isInverseBackLink() {
      return field == Field.INVERSE;
    }
  }

  /** The glossary term relations stored as {@code typeName}, an inverse partner of a deleted type. */
  public record PartnerUse(String typeName, int relationCount) {}

  private RelationshipTypeReferences() {}

  /** Every reference {@code owner} holds to another type; references to itself are left out. */
  public static List<Reference> heldBy(final RelationshipType owner) {
    final Stream<Reference> inverse = single(owner, Field.INVERSE, owner.getInverse());
    final Stream<Reference> replacedBy = single(owner, Field.REPLACED_BY, owner.getReplacedBy());
    final Stream<Reference> chain =
        listOrEmpty(owner.getPropertyChain()).stream()
            .map(target -> new Reference(owner, Field.PROPERTY_CHAIN, target));
    final Stream<Reference> disjoint =
        setOrEmpty(owner.getDisjointWith()).stream()
            .map(target -> new Reference(owner, Field.DISJOINT_WITH, target));
    return Stream.of(inverse, replacedBy, chain, disjoint)
        .flatMap(references -> references)
        .filter(reference -> reference.target() != null && !refersTo(reference.target(), owner))
        .toList();
  }

  /** The references other types, live or soft-deleted, hold to {@code target}. */
  public static List<Reference> referencesTo(
      final RelationshipType target, final Collection<RelationshipType> types) {
    return types.stream()
        .filter(type -> !Objects.equals(type.getId(), target.getId()))
        .flatMap(type -> heldBy(type).stream())
        .filter(reference -> refersTo(reference.target(), target))
        .toList();
  }

  /**
   * A reference names a type by id once it was resolved, and only by FQN when it was written before
   * its target existed. Callers pass references read through {@link RelationshipTypeReferenceNames},
   * which gives one stored with only a name its FQN.
   */
  public static boolean refersTo(final EntityReference reference, final RelationshipType type) {
    final boolean byId = reference.getId() != null && reference.getId().equals(type.getId());
    final boolean byFqn =
        reference.getFullyQualifiedName() != null
            && reference.getFullyQualifiedName().equals(type.getFullyQualifiedName());
    return byId || byFqn;
  }

  /**
   * A copy of {@code owner} without its references to any of {@code removed}. A property chain
   * naming one is dropped whole, since a chain without a member means something else.
   */
  public static RelationshipType withoutReferencesTo(
      final RelationshipType owner, final Collection<RelationshipType> removed) {
    final RelationshipType copy = JsonUtils.deepCopy(owner, RelationshipType.class);
    copy.setInverse(keptUnlessRemoved(copy.getInverse(), removed));
    copy.setReplacedBy(keptUnlessRemoved(copy.getReplacedBy(), removed));
    copy.setPropertyChain(
        listOrEmpty(copy.getPropertyChain()).stream().anyMatch(ref -> isRemoved(ref, removed))
            ? List.of()
            : copy.getPropertyChain());
    copy.setDisjointWith(
        setOrEmpty(copy.getDisjointWith()).stream()
            .filter(reference -> !isRemoved(reference, removed))
            .collect(Collectors.toUnmodifiableSet()));
    return copy;
  }

  private static EntityReference keptUnlessRemoved(
      final EntityReference reference, final Collection<RelationshipType> removed) {
    return reference == null || isRemoved(reference, removed) ? null : reference;
  }

  private static boolean isRemoved(
      final EntityReference reference, final Collection<RelationshipType> removed) {
    return removed.stream().anyMatch(type -> refersTo(reference, type));
  }

  public static String inUseMessage(
      final RelationshipType type,
      final List<Reference> references,
      final int relationCount,
      final List<PartnerUse> partnerUses) {
    final Stream<String> partnerReasons =
        partnerUses.stream().map(RelationshipTypeReferences::partnerSummary);
    final List<String> reasons =
        Stream.concat(
                Stream.of(referrerSummary(references), relationSummary(relationCount)),
                partnerReasons)
            .filter(Objects::nonNull)
            .toList();
    return "Relationship type '"
        + type.getName()
        + "' is in use and cannot be deleted: "
        + String.join("; ", reasons)
        + ". Remove these references first.";
  }

  private static String referrerSummary(final List<Reference> references) {
    final String summary;
    if (references.isEmpty()) {
      summary = null;
    } else {
      final List<String> listed =
          references.stream()
              .map(RelationshipTypeReferences::describe)
              .distinct()
              .sorted()
              .toList();
      final String shown =
          String.join(", ", listed.subList(0, Math.min(listed.size(), MAX_LISTED_REFERRERS)));
      final String more =
          listed.size() > MAX_LISTED_REFERRERS
              ? " and " + (listed.size() - MAX_LISTED_REFERRERS) + " more"
              : "";
      summary = "referenced by relationship type " + shown + more;
    }
    return summary;
  }

  private static String describe(final Reference reference) {
    final RelationshipType owner = reference.owner();
    final String deleted = Boolean.TRUE.equals(owner.getDeleted()) ? ", soft-deleted" : "";
    return "'" + owner.getName() + "' (" + reference.field().jsonName() + deleted + ")";
  }

  private static String relationSummary(final int relationCount) {
    return relationCount == 0 ? null : "used by " + relations(relationCount);
  }

  /**
   * A relation stored as the partner reads as the deleted type from its other end, so clearing the
   * partner's inverse would change what it says.
   */
  private static String partnerSummary(final PartnerUse use) {
    return "its inverse '"
        + use.typeName()
        + "' is used by "
        + relations(use.relationCount())
        + ", which read as this type from their other end";
  }

  private static String relations(final int count) {
    return count + (count == 1 ? " glossary term relation" : " glossary term relations");
  }

  private static Stream<Reference> single(
      final RelationshipType owner, final Field field, final EntityReference target) {
    return Stream.ofNullable(target).map(reference -> new Reference(owner, field, reference));
  }

  private static Set<EntityReference> setOrEmpty(final Set<EntityReference> references) {
    return references == null ? Set.of() : references;
  }
}
