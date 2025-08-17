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
import org.openmetadata.schema.utils.JsonUtils;
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
    Map<String, List<TagLabel>> result = new HashMap<>();

    // Group tag usages by target hash
    Map<String, List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash>> usagesByTarget =
        new HashMap<>();
    for (CollectionDAO.TagUsageDAO.TagLabelWithFQNHash usage : tagUsages) {
      usagesByTarget.computeIfAbsent(usage.getTargetFQNHash(), k -> new ArrayList<>()).add(usage);
    }

    // Process each target's tags
    for (Map.Entry<String, List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash>> entry :
        usagesByTarget.entrySet()) {
      String targetHash = entry.getKey();
      List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> targetUsages = entry.getValue();
      List<TagLabel> tagLabels = new ArrayList<>();

      // Separate tags that have JSON and those that don't
      List<String> tagsToFetch = new ArrayList<>();
      List<String> termsToFetch = new ArrayList<>();

      for (CollectionDAO.TagUsageDAO.TagLabelWithFQNHash usage : targetUsages) {
        // If we have JSON, parse it directly
        if (usage.getJson() != null && !usage.getJson().isEmpty()) {
          try {
            if (usage.getSource() == TagSource.CLASSIFICATION.ordinal()) {
              Tag tag = JsonUtils.readValue(usage.getJson(), Tag.class);
              TagLabel label = EntityUtil.toTagLabel(tag);
              label.setLabelType(TagLabel.LabelType.values()[usage.getLabelType()]);
              label.setState(TagLabel.State.values()[usage.getState()]);
              tagLabels.add(label);
            } else if (usage.getSource() == TagSource.GLOSSARY.ordinal()) {
              GlossaryTerm term = JsonUtils.readValue(usage.getJson(), GlossaryTerm.class);
              TagLabel label = EntityUtil.toTagLabel(term);
              label.setLabelType(TagLabel.LabelType.values()[usage.getLabelType()]);
              label.setState(TagLabel.State.values()[usage.getState()]);
              tagLabels.add(label);
            }
          } catch (Exception e) {
            // If parsing fails, fall back to fetching
            if (usage.getSource() == TagSource.CLASSIFICATION.ordinal()) {
              tagsToFetch.add(usage.getTagFQN());
            } else if (usage.getSource() == TagSource.GLOSSARY.ordinal()) {
              termsToFetch.add(usage.getTagFQN());
            }
          }
        } else {
          // No JSON, need to fetch
          if (usage.getSource() == TagSource.CLASSIFICATION.ordinal()) {
            tagsToFetch.add(usage.getTagFQN());
          } else if (usage.getSource() == TagSource.GLOSSARY.ordinal()) {
            termsToFetch.add(usage.getTagFQN());
          }
        }
      }

      // Fetch any remaining tags/terms that didn't have JSON
      if (!tagsToFetch.isEmpty()) {
        Tag[] tags = getTags(tagsToFetch).toArray(new Tag[0]);
        tagLabels.addAll(listOrEmpty(EntityUtil.toTagLabels(tags)));
      }
      if (!termsToFetch.isEmpty()) {
        GlossaryTerm[] terms = getGlossaryTerms(termsToFetch).toArray(new GlossaryTerm[0]);
        tagLabels.addAll(listOrEmpty(EntityUtil.toTagLabels(terms)));
      }

      result.put(targetHash, tagLabels);
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

  public static void checkDisabledTags(List<TagLabel> tagLabels) {
    for (TagLabel tagLabel : listOrEmpty(tagLabels)) {
      if (tagLabel.getSource().equals(TagSource.CLASSIFICATION)) {
        Tag tag = Entity.getCollectionDAO().tagDAO().findEntityByName(tagLabel.getTagFQN());
        if (tag.getDisabled()) {
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
