/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.tags;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class TagLabelUtil {
  private TagLabelUtil() {
    // Private constructor for utility class
  }

  public static Classification getClassification(String classificationName) {
    return Entity.getEntityByName(Entity.CLASSIFICATION, classificationName, "", NON_DELETED);
  }

  public static Tag getTag(String tagFqn) {
    return Entity.getEntityByName(Entity.TAG, tagFqn, "", NON_DELETED);
  }

  public static Map<String, List<TagLabel>> populateTagLabel(
      List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> tagUsages) {
    Map<String, List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash>> usagesByTarget =
        new HashMap<>();
    Set<String> allTagFqns = new HashSet<>();
    Set<String> allTermFqns = new HashSet<>();

    for (CollectionDAO.TagUsageDAO.TagLabelWithFQNHash usage : tagUsages) {
      usagesByTarget.computeIfAbsent(usage.getTargetFQNHash(), k -> new ArrayList<>()).add(usage);
      if (usage.getSource() == TagSource.CLASSIFICATION.ordinal()) {
        allTagFqns.add(usage.getTagFQN());
      } else if (usage.getSource() == TagSource.GLOSSARY.ordinal()) {
        allTermFqns.add(usage.getTagFQN());
      }
    }

    Map<String, List<TagLabel>> result = new HashMap<>();
    Map<String, TagLabel> tagLabelsByFqn = new HashMap<>();
    Map<String, TagLabel> termLabelsByFqn = new HashMap<>();

    if (!allTagFqns.isEmpty()) {
      try {
        getTags(new ArrayList<>(allTagFqns))
            .forEach(
                tag -> {
                  TagLabel label = EntityUtil.toTagLabel(tag);
                  if (label != null) {
                    tagLabelsByFqn.put(tag.getFullyQualifiedName(), label);
                  }
                });
      } catch (Exception ex) {
        LOG.warn(
            "Failed to batch fetch classification tags for {} targets. Skipping classification tags. Error: {}",
            usagesByTarget.size(),
            ex.getMessage());
      }
    }

    if (!allTermFqns.isEmpty()) {
      try {
        getGlossaryTerms(new ArrayList<>(allTermFqns))
            .forEach(
                term -> {
                  TagLabel label = EntityUtil.toTagLabel(term);
                  if (label != null) {
                    termLabelsByFqn.put(term.getFullyQualifiedName(), label);
                  }
                });
      } catch (Exception ex) {
        LOG.warn(
            "Failed to batch fetch glossary terms for {} targets. Skipping glossary tags. Error: {}",
            usagesByTarget.size(),
            ex.getMessage());
      }
    }

    for (Map.Entry<String, List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash>> entry :
        usagesByTarget.entrySet()) {
      String targetHash = entry.getKey();
      Set<TagLabel> tagLabels = new TreeSet<>(compareTagLabel);
      for (CollectionDAO.TagUsageDAO.TagLabelWithFQNHash usage : entry.getValue()) {
        TagLabel label =
            new TagLabel()
                .withSource(TagSource.values()[usage.getSource()])
                .withTagFQN(usage.getTagFQN())
                .withLabelType(TagLabel.LabelType.values()[usage.getLabelType()])
                .withState(TagLabel.State.values()[usage.getState()])
                .withReason(usage.getReason())
                .withAppliedAt(usage.getAppliedAt())
                .withAppliedBy(usage.getAppliedBy())
                .withMetadata(usage.getMetadata());
        TagLabel commonFields =
            usage.getSource() == TagSource.CLASSIFICATION.ordinal()
                ? tagLabelsByFqn.get(usage.getTagFQN())
                : termLabelsByFqn.get(usage.getTagFQN());
        if (commonFields != null) {
          label.setName(commonFields.getName());
          label.setDisplayName(commonFields.getDisplayName());
          label.setDescription(commonFields.getDescription());
          label.setStyle(commonFields.getStyle());
        }
        tagLabels.add(label);
      }
      result.put(targetHash, new ArrayList<>(tagLabels));
    }

    return result;
  }

  public static List<Tag> getTags(List<String> tagFQNs) {
    return Entity.getEntityByNames(Entity.TAG, tagFQNs, "", NON_DELETED);
  }

  public static List<GlossaryTerm> getGlossaryTerms(List<String> tagFQNs) {
    return Entity.getEntityByNames(Entity.GLOSSARY_TERM, tagFQNs, "", NON_DELETED);
  }

  public static Glossary getGlossary(String glossaryName) {
    return Entity.getEntityByName(Entity.GLOSSARY, glossaryName, "", NON_DELETED);
  }

  public static GlossaryTerm getGlossaryTerm(String glossaryTermFqn) {
    return Entity.getEntityByName(Entity.GLOSSARY_TERM, glossaryTermFqn, "", NON_DELETED);
  }

  public static void applyTagCommonFields(TagLabel label) {
    if (label.getSource() == TagSource.CLASSIFICATION) {
      Tag tag = getTag(label.getTagFQN());
      label.setName(tag.getName());
      label.setDisplayName(tag.getDisplayName());
      label.setDescription(tag.getDescription());
      label.setStyle(tag.getStyle());
    } else if (label.getSource() == TagSource.GLOSSARY) {
      GlossaryTerm glossaryTerm = getGlossaryTerm(label.getTagFQN());
      label.setName(glossaryTerm.getName());
      label.setDisplayName(glossaryTerm.getDisplayName());
      label.setDescription(glossaryTerm.getDescription());
      label.setStyle(glossaryTerm.getStyle());
    } else {
      throw new IllegalArgumentException("Invalid source type " + label.getSource());
    }
  }

  public static void applyTagCommonFieldsGracefully(TagLabel label) {
    try {
      applyTagCommonFields(label);
    } catch (Exception ex) {
      LOG.warn(
          "Failed to apply common fields for {} tag '{}'. Tag label will be returned without enrichment. Error: {}",
          label.getSource(),
          label.getTagFQN(),
          ex.getMessage());
    }
  }

  public static void applyTagCommonFieldsBatch(List<TagLabel> labels) {
    if (nullOrEmpty(labels)) {
      return;
    }

    Set<String> classificationFqns = new HashSet<>();
    Set<String> glossaryFqns = new HashSet<>();
    for (TagLabel label : labels) {
      if (label.getTagFQN() == null) {
        continue;
      }
      if (label.getSource() == TagSource.CLASSIFICATION) {
        classificationFqns.add(label.getTagFQN());
      } else if (label.getSource() == TagSource.GLOSSARY) {
        glossaryFqns.add(label.getTagFQN());
      }
    }

    Map<String, TagLabel> enrichedByFqn = new HashMap<>();

    if (!classificationFqns.isEmpty()) {
      try {
        getTags(new ArrayList<>(classificationFqns))
            .forEach(
                tag -> {
                  TagLabel enriched = EntityUtil.toTagLabel(tag);
                  if (enriched != null) {
                    enrichedByFqn.put(tag.getFullyQualifiedName(), enriched);
                  }
                });
      } catch (Exception ex) {
        LOG.warn("Failed to batch fetch classification tags: {}", ex.getMessage());
      }
    }

    if (!glossaryFqns.isEmpty()) {
      try {
        getGlossaryTerms(new ArrayList<>(glossaryFqns))
            .forEach(
                term -> {
                  TagLabel enriched = EntityUtil.toTagLabel(term);
                  if (enriched != null) {
                    enrichedByFqn.put(term.getFullyQualifiedName(), enriched);
                  }
                });
      } catch (Exception ex) {
        LOG.warn("Failed to batch fetch glossary terms: {}", ex.getMessage());
      }
    }

    for (TagLabel label : labels) {
      TagLabel enriched = enrichedByFqn.get(label.getTagFQN());
      if (enriched != null) {
        label.setName(enriched.getName());
        label.setDisplayName(enriched.getDisplayName());
        label.setDescription(enriched.getDescription());
        label.setStyle(enriched.getStyle());
      }
    }
  }

  /** Returns true if the parent of the tag label is mutually exclusive */
  public static boolean mutuallyExclusive(TagLabel label) {
    String[] fqnParts = FullyQualifiedName.split(label.getTagFQN());
    String parentFqn = FullyQualifiedName.getParentFQN(fqnParts);
    boolean rootParent = fqnParts.length == 2;
    if (label.getSource() == TagSource.CLASSIFICATION) {
      return rootParent
          ? getClassification(parentFqn).getMutuallyExclusive()
          : getTag(parentFqn).getMutuallyExclusive();
    } else if (label.getSource() == TagSource.GLOSSARY) {
      return rootParent
          ? getGlossary(parentFqn).getMutuallyExclusive()
          : getGlossaryTerm(parentFqn).getMutuallyExclusive();
    } else {
      throw new IllegalArgumentException("Invalid source type " + label.getSource());
    }
  }

  /**
   * Add derived tags to the given tag labels. This method is used in WRITE operations (create,
   * update) and will throw an exception if any derived tags cannot be fetched due to missing
   * entities.
   *
   * @param tagLabels the tag labels to add derived tags to
   * @return the tag labels with derived tags added
   * @throws RuntimeException if derived tags cannot be fetched
   */
  public static List<TagLabel> addDerivedTags(List<TagLabel> tagLabels) {
    if (nullOrEmpty(tagLabels)) {
      return tagLabels;
    }

    List<TagLabel> filteredTags =
        tagLabels.stream()
            .filter(Objects::nonNull)
            .filter(tag -> tag.getLabelType() != TagLabel.LabelType.DERIVED)
            .toList();

    List<TagLabel> updatedTagLabels = new ArrayList<>();
    EntityUtil.mergeTags(updatedTagLabels, filteredTags);
    for (TagLabel tagLabel : tagLabels) {
      if (tagLabel != null) {
        EntityUtil.mergeTags(updatedTagLabels, getDerivedTags(tagLabel));
      }
    }
    updatedTagLabels.sort(compareTagLabel);
    return updatedTagLabels;
  }

  /** Add derived tags using a single batch query. Falls back to non-derived tags on failure. */
  public static List<TagLabel> addDerivedTagsGracefully(List<TagLabel> tagLabels) {
    if (nullOrEmpty(tagLabels)) {
      return tagLabels;
    }
    try {
      Map<String, List<TagLabel>> derivedTagsMap = batchFetchDerivedTags(tagLabels);
      return addDerivedTagsWithPreFetched(tagLabels, derivedTagsMap);
    } catch (Exception ex) {
      LOG.warn(
          "Failed to batch fetch derived tags. Returning tags without derived. Error: {}",
          ex.getMessage());
      return tagLabels.stream()
          .filter(Objects::nonNull)
          .filter(tag -> tag.getLabelType() != TagLabel.LabelType.DERIVED)
          .sorted(compareTagLabel)
          .collect(Collectors.toList());
    }
  }

  private static List<TagLabel> getDerivedTags(TagLabel tagLabel) {
    if (tagLabel.getSource()
        == TagLabel.TagSource.GLOSSARY) { // Related tags are only supported for Glossary
      List<TagLabel> derivedTags =
          Entity.getCollectionDAO().tagUsageDAO().getTags(tagLabel.getTagFQN());
      derivedTags.forEach(tag -> tag.setLabelType(TagLabel.LabelType.DERIVED));
      return derivedTags;
    }
    return Collections.emptyList();
  }

  /** Batch fetch derived tags for all glossary terms in the list. Returns map of termFQNHash → derived tags. */
  public static Map<String, List<TagLabel>> batchFetchDerivedTags(List<TagLabel> tagLabels) {
    if (nullOrEmpty(tagLabels)) {
      return Collections.emptyMap();
    }

    List<String> glossaryTermFqns =
        tagLabels.stream()
            .filter(Objects::nonNull)
            .filter(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY)
            .map(TagLabel::getTagFQN)
            .distinct()
            .collect(Collectors.toList());

    if (glossaryTermFqns.isEmpty()) {
      return Collections.emptyMap();
    }

    int batchSize = 5000;
    if (glossaryTermFqns.size() <= batchSize) {
      return Entity.getCollectionDAO().tagUsageDAO().getDerivedTagsBatch(glossaryTermFqns);
    }
    Map<String, List<TagLabel>> result = new HashMap<>();
    for (int i = 0; i < glossaryTermFqns.size(); i += batchSize) {
      List<String> chunk =
          glossaryTermFqns.subList(i, Math.min(i + batchSize, glossaryTermFqns.size()));
      result.putAll(Entity.getCollectionDAO().tagUsageDAO().getDerivedTagsBatch(chunk));
    }
    return result;
  }

  /** Add derived tags using a pre-fetched map to avoid per-tag DB lookups. */
  public static List<TagLabel> addDerivedTagsWithPreFetched(
      List<TagLabel> tagLabels, Map<String, List<TagLabel>> derivedTagsMap) {
    if (nullOrEmpty(tagLabels)) {
      return tagLabels;
    }

    List<TagLabel> filteredTags =
        tagLabels.stream()
            .filter(Objects::nonNull)
            .filter(tag -> tag.getLabelType() != TagLabel.LabelType.DERIVED)
            .toList();

    List<TagLabel> updatedTagLabels = new ArrayList<>();
    EntityUtil.mergeTags(updatedTagLabels, filteredTags);

    for (TagLabel tagLabel : tagLabels) {
      if (tagLabel != null && tagLabel.getSource() == TagLabel.TagSource.GLOSSARY) {
        List<TagLabel> derivedTags =
            derivedTagsMap.getOrDefault(
                FullyQualifiedName.buildHash(tagLabel.getTagFQN()), Collections.emptyList());
        EntityUtil.mergeTags(updatedTagLabels, derivedTags);
      }
    }
    updatedTagLabels.sort(compareTagLabel);
    return updatedTagLabels;
  }

  public static List<TagLabel> getUniqueTags(List<TagLabel> tags) {
    Set<TagLabel> uniqueTags = new TreeSet<>(compareTagLabel);
    uniqueTags.addAll(tags);
    return uniqueTags.stream().toList();
  }

  public static void checkMutuallyExclusive(List<TagLabel> tagLabels) {
    Map<String, TagLabel> map = new HashMap<>();
    for (TagLabel tagLabel : listOrEmpty(tagLabels)) {
      // When two tags have the same parent that is mutuallyExclusive, then throw an error
      String parentFqn = FullyQualifiedName.getParentFQN(tagLabel.getTagFQN());
      TagLabel stored = map.put(parentFqn, tagLabel);
      if (stored != null && TagLabelUtil.mutuallyExclusive(tagLabel)) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.mutuallyExclusiveLabels(tagLabel, stored));
      }
    }
  }

  public static List<TagLabel> mergeTagsWithIncomingPrecedence(
      List<TagLabel> existingTags, List<TagLabel> incomingTags) {
    if (nullOrEmpty(incomingTags)) {
      return new ArrayList<>(listOrEmpty(existingTags));
    }
    Set<String> incomingParents =
        listOrEmpty(incomingTags).stream()
            .map(t -> FullyQualifiedName.getParentFQN(t.getTagFQN()))
            .collect(Collectors.toSet());

    List<TagLabel> result = new ArrayList<>();
    for (TagLabel existing : listOrEmpty(existingTags)) {
      String existingParent = FullyQualifiedName.getParentFQN(existing.getTagFQN());
      boolean isMutuallyExclusive = false;
      try {
        isMutuallyExclusive = mutuallyExclusive(existing);
      } catch (Exception ex) {
        LOG.warn(
            "Could not check mutual exclusivity for tag '{}': {}",
            existing.getTagFQN(),
            ex.getMessage());
      }
      if (isMutuallyExclusive && incomingParents.contains(existingParent)) {
        continue;
      }
      result.add(existing);
    }
    Set<String> resultFQNs = result.stream().map(TagLabel::getTagFQN).collect(Collectors.toSet());
    for (TagLabel incoming : incomingTags) {
      if (!resultFQNs.contains(incoming.getTagFQN())) {
        result.add(incoming);
      }
    }
    return result;
  }

  public static void checkDisabledTags(List<TagLabel> tagLabels) {
    if (nullOrEmpty(tagLabels)) {
      return;
    }

    // Collect all unique classification tag FQNs
    List<String> classificationFqns =
        listOrEmpty(tagLabels).stream()
            .filter(tag -> tag.getSource().equals(TagSource.CLASSIFICATION))
            .map(TagLabel::getTagFQN)
            .distinct()
            .collect(Collectors.toList());

    if (classificationFqns.isEmpty()) {
      return;
    }

    // Batch fetch all tags in ONE query
    List<Tag> tags = getTags(classificationFqns);
    Map<String, Tag> tagMap =
        tags.stream()
            .collect(Collectors.toMap(Tag::getFullyQualifiedName, tag -> tag, (a, b) -> a));

    // Check disabled status
    for (TagLabel tagLabel : listOrEmpty(tagLabels)) {
      if (tagLabel.getSource().equals(TagSource.CLASSIFICATION)) {
        Tag tag = tagMap.get(tagLabel.getTagFQN());
        if (tag != null && tag.getDisabled()) {
          throw new IllegalArgumentException(CatalogExceptionMessage.disabledTag(tagLabel));
        }
      }
    }
  }

  public static void checkMutuallyExclusiveForParentAndSubField(
      String assetFqn,
      String assetFqnHash,
      Map<String, List<TagLabel>> allAssetTags,
      List<TagLabel> glossaryTags,
      boolean validateSubFields) {
    boolean failed = false;
    StringBuilder errorMessage = new StringBuilder();

    Map<String, List<TagLabel>> filteredTags =
        allAssetTags.entrySet().stream()
            .filter(entry -> entry.getKey().startsWith(assetFqnHash))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

    // Check Parent Tags
    List<TagLabel> parentTags = filteredTags.remove(assetFqnHash);

    if (parentTags != null) {
      List<TagLabel> tempList = new ArrayList<>(addDerivedTags(parentTags));
      tempList.addAll(glossaryTags);
      try {
        checkMutuallyExclusive(getUniqueTags(tempList));
      } catch (IllegalArgumentException ex) {
        failed = true;
        tempList.removeAll(glossaryTags);
        errorMessage.append(
            String.format(
                "Asset %s has a tag %s which is mutually exclusive with the one of the glossary tags %s. %n",
                assetFqn,
                converTagLabelArrayToString(tempList),
                converTagLabelArrayToString(glossaryTags)));
      }
    }

    if (validateSubFields) {
      // Check SubFields Tags
      Set<TagLabel> subFieldTags =
          filteredTags.values().stream().flatMap(List::stream).collect(Collectors.toSet());
      List<TagLabel> tempList = new ArrayList<>(addDerivedTags(subFieldTags.stream().toList()));
      tempList.addAll(glossaryTags);
      try {
        checkMutuallyExclusive(getUniqueTags(tempList));
      } catch (IllegalArgumentException ex) {
        failed = true;
        errorMessage.append(
            String.format(
                "Asset %s has a Subfield Column/Schema/Field containing tags %s which is mutually exclusive with the one of the glossary tags %s",
                assetFqn,
                converTagLabelArrayToString(tempList),
                converTagLabelArrayToString(glossaryTags)));
      }
    }

    // Throw Exception if failed
    if (failed) {
      throw new IllegalArgumentException(errorMessage.toString());
    }
  }

  public static String converTagLabelArrayToString(List<TagLabel> tags) {
    return String.format(
        "[%s]", tags.stream().map(TagLabel::getTagFQN).collect(Collectors.joining(", ")));
  }
}
