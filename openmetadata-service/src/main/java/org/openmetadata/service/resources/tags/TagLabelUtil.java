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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
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

  // TODO: Below two methods :addDerivedTags and :getDerivedTags can be removed from Entity Repository
  public static List<TagLabel> addDerivedTags(List<TagLabel> tagLabels) {
    if (nullOrEmpty(tagLabels)) {
      return tagLabels;
    }

    List<TagLabel> updatedTagLabels = new ArrayList<>();
    EntityUtil.mergeTags(updatedTagLabels, tagLabels);
    for (TagLabel tagLabel : tagLabels) {
      EntityUtil.mergeTags(updatedTagLabels, getDerivedTags(tagLabel));
    }
    updatedTagLabels.sort(compareTagLabel);
    return updatedTagLabels;
  }

  private static List<TagLabel> getDerivedTags(TagLabel tagLabel) {
    if (tagLabel.getSource() == TagLabel.TagSource.GLOSSARY) { // Related tags are only supported for Glossary
      List<TagLabel> derivedTags = Entity.getCollectionDAO().tagUsageDAO().getTags(tagLabel.getTagFQN());
      derivedTags.forEach(tag -> tag.setLabelType(TagLabel.LabelType.DERIVED));
      return derivedTags;
    }
    return Collections.emptyList();
  }
}
