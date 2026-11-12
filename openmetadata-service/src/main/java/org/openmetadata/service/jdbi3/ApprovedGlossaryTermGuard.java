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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Only an Approved glossary term can be applied to a data asset or to one of its fields, whichever
 * API applies it (ADR:2026-11-06-only-approved-glossary-terms-can-be-newly-applied-to-an-asset).
 * A write is judged per target, the asset or a field addressed by its FQN: a term is new on a
 * target that does not already hold it in its own right. A term that leaves Approved later stays
 * where it was applied, so writes that carry it back to the same target still pass. Terms are
 * compared by FQN hash, the way they are stored and looked up, so quoting cannot disguise one.
 */
public final class ApprovedGlossaryTermGuard {

  private ApprovedGlossaryTermGuard() {}

  /**
   * Labels on the entity and on every field nested under it, keyed by target FQN. {@code
   * fieldsByContainer} holds the entity's tagged inline fields by the container path that holds
   * them, as {@link EntityRepository#taggedFieldContainers} reports them.
   */
  public static Map<String, List<TagLabel>> tagsByTarget(
      EntityInterface<?> entity, Map<String, List<? extends FieldInterface>> fieldsByContainer) {
    Map<String, List<TagLabel>> tagsByTarget = new HashMap<>();
    taggedTargets(entity, fieldsByContainer)
        .forEach(target -> addTags(tagsByTarget, target.fqn(), target.tags()));
    return tagsByTarget;
  }

  /**
   * Like {@link #tagsByTarget}, but keyed by the FQN {@code stored} gives the same target. A move
   * rewrites the FQNs of an entity's fields before the write re-keys their stored labels, so a
   * field is matched to its stored self by its name path, not by its FQN.
   */
  public static Map<String, List<TagLabel>> tagsByStoredTarget(
      TaggedEntity entity, TaggedEntity stored) {
    Map<List<String>, String> storedFqnByPath = new HashMap<>();
    taggedTargets(stored.entity(), stored.fieldsByContainer())
        .forEach(target -> storedFqnByPath.putIfAbsent(target.namePath(), target.fqn()));
    Map<String, List<TagLabel>> tagsByTarget = new HashMap<>();
    taggedTargets(entity.entity(), entity.fieldsByContainer())
        .forEach(
            target ->
                addTags(
                    tagsByTarget,
                    storedFqnByPath.getOrDefault(target.namePath(), target.fqn()),
                    target.tags()));
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
    Rejected rejected = rejectedTerms(requested, held);
    Map<String, String> rejections = new TreeMap<>();
    rejected
        .termHashesByTarget()
        .forEach(
            (target, hashes) ->
                rejections.put(
                    String.valueOf(target),
                    TagLabelUtil.unapprovedTermMessage(
                        rejected.termsByHash().get(new TreeSet<>(hashes).first()))));
    return rejections;
  }

  /**
   * For each target, the hashes of the terms {@code requested} applies to it that would be
   * rejected: not Approved, and not already held there. Whether a target holds a term does not
   * depend on who asks, so one call can judge many requests that share targets, each through
   * {@link #appliesAnyOf}.
   */
  public static Map<String, Set<String>> rejectedTermHashesByTarget(
      Map<String, List<TagLabel>> requested, Map<String, List<TagLabel>> held) {
    return rejectedTerms(requested, held).termHashesByTarget();
  }

  /** Whether {@code tags} apply any of the terms {@code termHashes} names. */
  public static boolean appliesAnyOf(List<TagLabel> tags, Set<String> termHashes) {
    return !termHashes.isEmpty()
        && TagLabelUtil.appliedGlossaryTermFqns(tags).stream()
            .map(ApprovedGlossaryTermGuard::termHash)
            .anyMatch(termHashes::contains);
  }

  private record Rejected(
      Map<String, Set<String>> termHashesByTarget, Map<String, GlossaryTerm> termsByHash) {}

  private static Rejected rejectedTerms(
      Map<String, List<TagLabel>> requested, Map<String, List<TagLabel>> held) {
    Map<String, Set<String>> requestedTerms = appliedTermsByTarget(requested);
    Map<String, GlossaryTerm> unapprovedByHash =
        TagLabelUtil.unapprovedGlossaryTerms(allTerms(requestedTerms)).stream()
            .collect(Collectors.toMap(term -> termHash(term.getFullyQualifiedName()), t -> t));
    Map<String, Set<String>> newlyApplied = termHashesByTarget(requestedTerms);
    newlyApplied.values().forEach(hashes -> hashes.retainAll(unapprovedByHash.keySet()));
    newlyApplied.values().removeIf(Set::isEmpty);
    dropHeld(newlyApplied, termHashesByTarget(appliedTermsByTarget(held)));
    if (!newlyApplied.isEmpty()) {
      dropHeld(newlyApplied, storedTermHashesByTarget(newlyApplied.keySet()));
    }
    return new Rejected(newlyApplied, unapprovedByHash);
  }

  /**
   * A tagged inline field whose type does not implement {@link FieldInterface} (a pipeline task, an
   * ML feature), so it can be walked like one.
   */
  public record TaggedField(String name, String fullyQualifiedName, List<TagLabel> tags)
      implements FieldInterface {
    public static TaggedField of(String name, String fullyQualifiedName, List<TagLabel> tags) {
      return new TaggedField(name, fullyQualifiedName, listOrEmpty(tags));
    }

    @Override
    public String getName() {
      return name;
    }

    @Override
    public String getDisplayName() {
      return null;
    }

    @Override
    public String getDescription() {
      return null;
    }

    @Override
    public String getDataTypeDisplay() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return fullyQualifiedName;
    }

    @Override
    public List<TagLabel> getTags() {
      return tags;
    }

    @Override
    public List<? extends FieldInterface> getChildren() {
      return List.of();
    }
  }

  /** An entity with its tagged inline fields, by the container path that holds them. */
  public record TaggedEntity(
      EntityInterface<?> entity, Map<String, List<? extends FieldInterface>> fieldsByContainer) {}

  // A target is the entity (empty name path) or a field, named by its container path and the
  // field names leading to it. Field names are matched the way columns are, ignoring case.
  private record TaggedTarget(List<String> namePath, String fqn, List<TagLabel> tags) {}

  private static List<TaggedTarget> taggedTargets(
      EntityInterface<?> entity, Map<String, List<? extends FieldInterface>> fieldsByContainer) {
    List<TaggedTarget> targets = new ArrayList<>();
    targets.add(
        new TaggedTarget(List.of(), entity.getFullyQualifiedName(), listOrEmpty(entity.getTags())));
    fieldsByContainer.forEach(
        (containerPath, fields) -> collectFields(fields, List.of(containerPath), targets));
    return targets;
  }

  private static void collectFields(
      List<? extends FieldInterface> fields, List<String> parentPath, List<TaggedTarget> targets) {
    for (FieldInterface field : listOrEmpty(fields)) {
      List<String> namePath =
          Stream.concat(
                  parentPath.stream(),
                  Stream.of(String.valueOf(field.getName()).toLowerCase(Locale.ROOT)))
              .toList();
      targets.add(
          new TaggedTarget(namePath, field.getFullyQualifiedName(), listOrEmpty(field.getTags())));
      collectFields(field.getChildren(), namePath, targets);
    }
  }

  private static void addTags(
      Map<String, List<TagLabel>> tagsByTarget, String target, List<TagLabel> tags) {
    tagsByTarget.computeIfAbsent(target, key -> new ArrayList<>()).addAll(tags);
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

  private static Map<String, Set<String>> termHashesByTarget(Map<String, Set<String>> terms) {
    Map<String, Set<String>> hashesByTarget = new HashMap<>();
    terms.forEach(
        (target, fqns) ->
            hashesByTarget.put(
                target,
                fqns.stream()
                    .map(ApprovedGlossaryTermGuard::termHash)
                    .collect(Collectors.toCollection(HashSet::new))));
    return hashesByTarget;
  }

  private static String termHash(String termFqn) {
    return FullyQualifiedName.buildHash(termFqn);
  }

  private static void dropHeld(
      Map<String, Set<String>> newlyApplied, Map<String, Set<String>> heldByTarget) {
    heldByTarget.forEach(
        (target, held) -> {
          Set<String> hashes = newlyApplied.get(target);
          if (hashes != null) {
            hashes.removeAll(held);
          }
        });
    newlyApplied.values().removeIf(Set::isEmpty);
  }

  private static Map<String, Set<String>> storedTermHashesByTarget(Set<String> targets) {
    Map<String, String> targetByHash =
        targets.stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toMap(FullyQualifiedName::buildHash, target -> target));
    Map<String, List<TagLabel>> storedByTarget = new HashMap<>();
    Entity.getCollectionDAO()
        .tagUsageDAO()
        .getTagsByTargetFQNHashes(List.copyOf(targetByHash.keySet()))
        .forEach((hash, tags) -> storedByTarget.put(targetByHash.get(hash), tags));
    return termHashesByTarget(appliedTermsByTarget(storedByTarget));
  }

  private static Set<String> allTerms(Map<String, Set<String>> termsByTarget) {
    Set<String> terms = new HashSet<>();
    termsByTarget.values().forEach(terms::addAll);
    return terms;
  }
}
