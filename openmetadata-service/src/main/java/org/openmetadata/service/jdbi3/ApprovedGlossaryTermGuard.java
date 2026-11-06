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
package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Only an Approved glossary term can be applied to a data asset or to one of its fields, whichever
 * API applies it (ADR:2026-11-06-only-approved-glossary-terms-can-be-newly-applied-to-an-asset).
 * A write is judged per target, the asset or a field addressed by its FQN: a term is new on a
 * target that does not already hold it in its own right. A term that leaves Approved later stays
 * where it was applied, so writes that carry it back to the same target still pass.
 */
public final class ApprovedGlossaryTermGuard {

  private ApprovedGlossaryTermGuard() {}

  /** Labels on the entity and on every field nested under it, keyed by target FQN. */
  public static Map<String, List<TagLabel>> tagsByTarget(
      EntityInterface<?> entity, String entityType) {
    Map<String, List<TagLabel>> tagsByTarget = new HashMap<>();
    tagsByTarget.put(entity.getFullyQualifiedName(), listOrEmpty(entity.getTags()));
    if (ChildFieldResolver.supports(entityType)) {
      collectFieldTags(ChildFieldResolver.childrenOf(entity, entityType), tagsByTarget);
    }
    return tagsByTarget;
  }

  /** Rejects any glossary term {@code requested} applies that is not Approved: nothing is held. */
  public static void checkApplied(Map<String, List<TagLabel>> requested) {
    TagLabelUtil.checkGlossaryTermsApproved(allTerms(appliedTermsByTarget(requested)));
  }

  /**
   * Rejects a glossary term that is not Approved and that {@code requested} applies to a target not
   * already holding it. {@code held} is what the caller has loaded of the stored state; a target it
   * does not account for is read from {@code tag_usage}, so a partial projection cannot make a
   * stored term look new.
   */
  public static void checkNewlyApplied(
      Map<String, List<TagLabel>> requested, Map<String, List<TagLabel>> held) {
    rejectionsByTarget(requested, held).values().stream()
        .findFirst()
        .ifPresent(
            message -> {
              throw new IllegalArgumentException(message);
            });
  }

  /**
   * For each target {@link #checkNewlyApplied} would reject, the message it would reject with. Terms
   * are looked up once for every target, and stored labels are read only when a term that is not
   * Approved reaches a target that the loaded state does not show holding it.
   */
  public static Map<String, String> rejectionsByTarget(
      Map<String, List<TagLabel>> requested, Map<String, List<TagLabel>> held) {
    Map<String, Set<String>> appliedByTarget = appliedTermsByTarget(requested);
    Map<String, GlossaryTerm> unapproved =
        TagLabelUtil.unapprovedGlossaryTerms(allTerms(appliedByTarget)).stream()
            .collect(Collectors.toMap(GlossaryTerm::getFullyQualifiedName, term -> term));
    appliedByTarget.values().forEach(terms -> terms.retainAll(unapproved.keySet()));
    appliedByTarget.values().removeIf(Set::isEmpty);
    dropHeld(appliedByTarget, appliedTermsByTarget(held));
    if (!appliedByTarget.isEmpty()) {
      dropHeld(appliedByTarget, storedTermsByTarget(appliedByTarget.keySet()));
    }
    Map<String, String> rejections = new TreeMap<>();
    appliedByTarget.forEach(
        (target, terms) ->
            rejections.put(
                String.valueOf(target),
                TagLabelUtil.unapprovedTermMessage(unapproved.get(new TreeSet<>(terms).first()))));
    return rejections;
  }

  private static void collectFieldTags(
      List<? extends FieldInterface> fields, Map<String, List<TagLabel>> tagsByTarget) {
    for (FieldInterface field : listOrEmpty(fields)) {
      tagsByTarget.put(field.getFullyQualifiedName(), listOrEmpty(field.getTags()));
      collectFieldTags(field.getChildren(), tagsByTarget);
    }
  }

  // Labels a target only inherits or derives are not applied to it, on either side.
  private static Map<String, Set<String>> appliedTermsByTarget(
      Map<String, List<TagLabel>> tagsByTarget) {
    Map<String, Set<String>> termsByTarget = new HashMap<>();
    tagsByTarget.forEach(
        (target, tags) -> {
          Set<String> terms = TagLabelUtil.appliedGlossaryTermFqns(tags);
          if (!terms.isEmpty()) {
            termsByTarget.put(target, terms);
          }
        });
    return termsByTarget;
  }

  private static void dropHeld(
      Map<String, Set<String>> newlyApplied, Map<String, Set<String>> heldByTarget) {
    heldByTarget.forEach(
        (target, held) -> {
          Set<String> terms = newlyApplied.get(target);
          if (terms != null) {
            terms.removeAll(held);
          }
        });
    newlyApplied.values().removeIf(Set::isEmpty);
  }

  private static Map<String, Set<String>> storedTermsByTarget(Set<String> targets) {
    Map<String, String> targetByHash =
        targets.stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toMap(FullyQualifiedName::buildHash, target -> target));
    Map<String, List<TagLabel>> storedByTarget = new HashMap<>();
    Entity.getCollectionDAO()
        .tagUsageDAO()
        .getTagsByTargetFQNHashes(List.copyOf(targetByHash.keySet()))
        .forEach((hash, tags) -> storedByTarget.put(targetByHash.get(hash), tags));
    return appliedTermsByTarget(storedByTarget);
  }

  private static Set<String> allTerms(Map<String, Set<String>> termsByTarget) {
    Set<String> terms = new HashSet<>();
    termsByTarget.values().forEach(terms::addAll);
    return terms;
  }
}
