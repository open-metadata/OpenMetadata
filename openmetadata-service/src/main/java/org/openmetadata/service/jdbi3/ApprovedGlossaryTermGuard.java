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
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Only an Approved glossary term shows on a data asset or on one of its fields, whichever API
 * applies it (ADR:2026-11-06-only-approved-glossary-terms-can-be-newly-applied-to-an-asset). A
 * write that newly applies a term that is not Approved is not refused: the term is taken out of the
 * write and stored as pending (a storage state only the tag DAO knows), which no tag read returns, until the term is
 * approved. A write is judged per target, the asset or a field addressed by its FQN: a term is new
 * on a target that does not already hold it in its own right. A term that leaves Approved later
 * stays where it was applied, so writes that carry it back to the same target keep it. Terms are
 * compared by FQN hash, the way they are stored and looked up, so quoting cannot disguise one.
 */
public final class ApprovedGlossaryTermGuard {

  private ApprovedGlossaryTermGuard() {}

  /** A glossary term held back from a target until it is Approved, as the label to store. */
  public record HeldTerm(String targetFqn, TagLabel label) {}

  /** An entity with its tagged inline fields, by the container path that holds them. */
  public record TaggedEntity(
      EntityInterface<?> entity, Map<String, List<? extends FieldInterface>> fieldsByContainer) {}

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
   * Takes out of {@code entity} and its fields each glossary term that is not Approved and that it
   * newly applies, and returns them, to be stored as pending. {@code stored} is the entity as it is
   * stored, or null for a create.
   */
  public static List<HeldTerm> holdNewlyApplied(TaggedEntity entity, TaggedEntity stored) {
    Map<List<String>, String> storedFqnByPath = storedFqnByPath(stored);
    Map<String, Set<String>> held =
        heldTermHashesByTarget(
            requestedByStoredTarget(entity, storedFqnByPath), storedTags(stored));
    List<HeldTerm> heldTerms = new ArrayList<>();
    if (!held.isEmpty()) {
      for (TaggedTarget target : taggedTargets(entity.entity(), entity.fieldsByContainer())) {
        Set<String> termHashes =
            held.get(storedFqnByPath.getOrDefault(target.namePath(), target.fqn()));
        take(target, termHashes).forEach(label -> heldTerms.add(new HeldTerm(target.fqn(), label)));
      }
    }
    return heldTerms;
  }

  /**
   * For each target, the hashes of the terms {@code requested} applies to it that are held back:
   * not Approved, and not already held there. {@code held} is what the caller has loaded of the
   * stored state; a target it does not account for is read from {@code tag_usage}, so a partial
   * projection cannot make a stored term look new. Only terms a target does not already hold are
   * looked up, in one batch for every target.
   */
  public static Map<String, Set<String>> heldTermHashesByTarget(
      Map<String, List<TagLabel>> requested, Map<String, List<TagLabel>> held) {
    Map<String, Set<String>> requestedTerms = appliedTermsByTarget(requested);
    Map<String, Set<String>> newlyApplied = termHashesByTarget(requestedTerms);
    // Held terms are dropped before any lookup, so an edit that applies no new term reads nothing.
    dropHeld(newlyApplied, termHashesByTarget(appliedTermsByTarget(held)));
    Set<String> unapproved = unapprovedHashes(requestedTerms, newlyApplied);
    newlyApplied.values().forEach(hashes -> hashes.retainAll(unapproved));
    newlyApplied.values().removeIf(Set::isEmpty);
    if (!newlyApplied.isEmpty()) {
      dropHeld(newlyApplied, storedTermHashesByTarget(newlyApplied.keySet()));
    }
    return newlyApplied;
  }

  /**
   * Adds to the entity's targets the labels {@code labelsByTargetHash} names for them, through each
   * target's holder, and returns how many it added. A target that already applies the term keeps
   * its labels as they are.
   */
  public static int addToTargets(TaggedEntity entity, Map<String, TagLabel> labelsByTargetHash) {
    int added = 0;
    for (TaggedTarget target : taggedTargets(entity.entity(), entity.fieldsByContainer())) {
      TagLabel label =
          target.fqn() == null
              ? null
              : labelsByTargetHash.get(FullyQualifiedName.buildHash(target.fqn()));
      if (label != null
          && !TagLabelUtil.appliedGlossaryTermFqns(target.tags()).contains(label.getTagFQN())) {
        List<TagLabel> tags = new ArrayList<>(target.tags());
        tags.add(label);
        target.replaceTags().accept(tags);
        added++;
      }
    }
    return added;
  }

  /** Removes the labels of the terms {@code termHashes} names from {@code tags}, returning them. */
  public static List<TagLabel> takeTerms(List<TagLabel> tags, Set<String> termHashes) {
    List<TagLabel> taken = new ArrayList<>();
    if (tags != null && termHashes != null && !termHashes.isEmpty()) {
      tags.stream().filter(label -> appliesAnyOf(List.of(label), termHashes)).forEach(taken::add);
      tags.removeAll(taken);
    }
    return taken;
  }

  /** Whether {@code tags} apply any of the terms {@code termHashes} names. */
  public static boolean appliesAnyOf(List<TagLabel> tags, Set<String> termHashes) {
    return termHashes != null
        && TagLabelUtil.appliedGlossaryTermFqns(tags).stream()
            .map(ApprovedGlossaryTermGuard::termHash)
            .anyMatch(termHashes::contains);
  }

  // A target's labels are replaced through its holder, so a list the holder exposes read-only is
  // handled too. A holder that ignores the new list would keep the term applied: it is refused.
  private static List<TagLabel> take(TaggedTarget target, Set<String> termHashes) {
    List<TagLabel> remaining = new ArrayList<>(target.tags());
    List<TagLabel> taken = takeTerms(remaining, termHashes);
    if (!taken.isEmpty()) {
      remaining.removeAll(derivedOnlyFrom(taken, remaining));
      target.replaceTags().accept(remaining);
      if (appliesAnyOf(listOrEmpty(target.currentTags().get()), termHashes)) {
        throw new IllegalArgumentException(
            "Only Approved glossary terms can be applied to %s".formatted(target.fqn()));
      }
    }
    return taken;
  }

  // validateTags has already added the classification tags each applied term carries as DERIVED
  // labels. The ones only a held term carries would show it before approval, so they go with it.
  private static List<TagLabel> derivedOnlyFrom(List<TagLabel> taken, List<TagLabel> remaining) {
    List<TagLabel> derived =
        remaining.stream().filter(label -> label.getLabelType() == LabelType.DERIVED).toList();
    List<TagLabel> orphaned = List.of();
    if (!derived.isEmpty()) {
      Set<String> carriedByHeld = carriedTagFqns(taken);
      Set<String> carriedByKept =
          carriedTagFqns(
              remaining.stream()
                  .filter(label -> label.getLabelType() != LabelType.DERIVED)
                  .toList());
      orphaned =
          derived.stream()
              .filter(label -> carriedByHeld.contains(label.getTagFQN()))
              .filter(label -> !carriedByKept.contains(label.getTagFQN()))
              .toList();
    }
    return orphaned;
  }

  private static Set<String> carriedTagFqns(List<TagLabel> labels) {
    return TagLabelUtil.batchFetchDerivedTags(labels).values().stream()
        .flatMap(List::stream)
        .map(TagLabel::getTagFQN)
        .collect(Collectors.toSet());
  }

  // A move rewrites the FQNs of an entity's fields before the write re-keys their stored labels,
  // so a field is matched to its stored self by its name path, not by its FQN.
  private static Map<List<String>, String> storedFqnByPath(TaggedEntity stored) {
    Map<List<String>, String> storedFqnByPath = new HashMap<>();
    if (stored != null) {
      taggedTargets(stored.entity(), stored.fieldsByContainer())
          .forEach(target -> storedFqnByPath.putIfAbsent(target.namePath(), target.fqn()));
    }
    return storedFqnByPath;
  }

  private static Map<String, List<TagLabel>> requestedByStoredTarget(
      TaggedEntity entity, Map<List<String>, String> storedFqnByPath) {
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

  private static Map<String, List<TagLabel>> storedTags(TaggedEntity stored) {
    return stored == null ? Map.of() : tagsByTarget(stored.entity(), stored.fieldsByContainer());
  }

  // Looks up only the terms some target newly applies, in one batch.
  private static Set<String> unapprovedHashes(
      Map<String, Set<String>> requestedTerms, Map<String, Set<String>> newlyApplied) {
    Set<String> newHashes = allTerms(newlyApplied);
    Set<String> newTerms =
        allTerms(requestedTerms).stream()
            .filter(fqn -> newHashes.contains(termHash(fqn)))
            .collect(Collectors.toSet());
    return TagLabelUtil.unapprovedGlossaryTerms(newTerms).stream()
        .map(GlossaryTerm::getFullyQualifiedName)
        .map(ApprovedGlossaryTermGuard::termHash)
        .collect(Collectors.toSet());
  }

  // A target is the entity (empty name path) or a field, named by its container path and the
  // field names leading to it. Field names are matched the way columns are, ignoring case.
  private record TaggedTarget(
      List<String> namePath,
      String fqn,
      List<TagLabel> tags,
      Supplier<List<TagLabel>> currentTags,
      Consumer<List<TagLabel>> replaceTags) {}

  private static List<TaggedTarget> taggedTargets(
      EntityInterface<?> entity, Map<String, List<? extends FieldInterface>> fieldsByContainer) {
    List<TaggedTarget> targets = new ArrayList<>();
    targets.add(
        new TaggedTarget(
            List.of(),
            entity.getFullyQualifiedName(),
            listOrEmpty(entity.getTags()),
            entity::getTags,
            entity::setTags));
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
          new TaggedTarget(
              namePath,
              field.getFullyQualifiedName(),
              listOrEmpty(field.getTags()),
              field::getTags,
              field::setTags));
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
            .collect(
                Collectors.toMap(FullyQualifiedName::buildHash, target -> target, (a, b) -> a));
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
