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

package org.openmetadata.catalog.security.policyevaluator;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;
import lombok.Builder;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Facts;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;

@Slf4j
@Builder(setterPrefix = "with")
class AttributeBasedFacts {
  private MetadataOperation operation;
  private Object entity; // Entity can be null in some cases, where the operation may not be on a specific entity.
  private boolean checkOperation;

  // Do not allow anything external or the builder itself change the value of facts.
  // Individual Fact(s) within facts may be changed by the RulesEngine.
  private final Facts facts = new Facts();

  /**
   * Creates {@link Facts} with the operation, and entity (object) attributes so that it is recognizable by {@link
   * org.jeasy.rules.api.RulesEngine}
   */
  public Facts getFacts() {
    // Facts to be taken into consideration by RuleCondition.
    facts.put(CommonFields.ENTITY_TAGS, getEntityTags(entity));
    facts.put(CommonFields.ENTITY_TYPE, getEntityType(entity));
    if (checkOperation) {
      facts.put(CommonFields.OPERATION, operation);
    }
    facts.put(CommonFields.CHECK_OPERATION, checkOperation);

    // Facts to be taken into consideration by Actions. The values of these facts will change as Action(s) get executed.
    facts.put(CommonFields.ALLOW, CommonFields.DEFAULT_ACCESS);
    facts.put(CommonFields.ALLOWED_OPERATIONS, new HashSet<MetadataOperation>());
    LOG.debug("Generated facts successfully - {}", facts);
    return facts;
  }

  public boolean hasPermission() {
    return facts.get(CommonFields.ALLOW);
  }

  public List<MetadataOperation> getAllowedOperations() {
    return new ArrayList<>(facts.get(CommonFields.ALLOWED_OPERATIONS));
  }

  private List<String> getEntityTags(Object entity) {
    if (entity == null) {
      return Collections.emptyList();
    }
    List<TagLabel> entityTags = null;
    try {
      EntityInterface<?> entityInterface = Entity.getEntityInterface(entity);
      entityTags = entityInterface.getTags();
    } catch (EntityNotFoundException e) {
      LOG.warn("could not obtain tags for the given entity {} - exception: {}", entity, e.toString());
    }
    if (entityTags == null) {
      return Collections.emptyList();
    }
    return entityTags.stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
  }

  private static String getEntityType(Object entity) {
    if (entity == null) {
      return ""; // Fact cannot be null. getFacts will throw NPE if this is null.
    }
    String entityType = Entity.getEntityTypeFromObject(entity);
    if (entityType == null) {
      LOG.warn("could not find entity type for the given entity {}", entity);
    }
    return entityType;
  }
}
