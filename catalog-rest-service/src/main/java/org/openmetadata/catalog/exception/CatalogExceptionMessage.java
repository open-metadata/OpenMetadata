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

package org.openmetadata.catalog.exception;

import java.util.UUID;
import org.openmetadata.catalog.type.EntityReference;

public final class CatalogExceptionMessage {
  public static final String ENTITY_ALREADY_EXISTS = "Entity already exists";
  public static final String ENTITY_NAME_EMPTY = "Entity name can't be empty";

  private CatalogExceptionMessage() {}

  public static String containerNotFound(EntityReference entityReference) {
    return String.format("Container for %s %s not found", entityReference.getType(), entityReference.getId());
  }

  public static String danglingLink(EntityReference source, EntityReference target) {
    return String.format(
        "Dead link for %s %s, %s %s not found", source.getType(), source.getId(), target.getType(), target.getId());
  }

  public static String multipleSomethingFound(String something, EntityReference entityReference) {
    return String.format(
        "Consistency problem, multiple %s found for %s %s",
        something, entityReference.getType(), entityReference.getId());
  }

  public static String entityNotFound(String entityType, String id) {
    return String.format("%s instance for %s not found", entityType, id);
  }

  public static String entityNotFound(String entityType, UUID id) {
    return entityNotFound(entityType, id.toString());
  }

  public static String readOnlyAttribute(String entityType, String attribute) {
    return String.format("%s attribute %s can't be modified", entityType, attribute);
  }

  public static String entityNotFound(EntityReference entityReference) {
    return entityNotFound(entityReference.getType(), entityReference.getId());
  }

  public static String entityNotFound(String targetEntityType, String relationship, String sourceEntityType, UUID id) {
    return String.format(
        "The %s instance %s doesn't have a %s that `%s` it",
        sourceEntityType, id.toString(), targetEntityType, relationship);
  }

  public static String invalidField(String field) {
    return String.format("Invalid field name %s", field);
  }

  public static String entityTypeNotFound(String entityType) {
    return String.format("Entity type %s not found", entityType);
  }

  public static String wrongEntityType(String entity) {
    return String.format("Entity type %s cannot be used here", entity);
  }

  public static String fieldIsNull(String field) {
    return String.format("Field %s is null", field);
  }

  public static String deactivatedUser(UUID id) {
    return String.format("User %s is deactivated", id);
  }

  public static String invalidColumnFQN(String fqn) {
    return String.format("Invalid fully qualified column name %s", fqn);
  }

  public static String entityVersionNotFound(String entityType, String id, Double version) {
    return String.format("%s instance for %s and version %s not found", entityType, id, version);
  }

  public static String invalidServiceEntity(String serviceEntity, String entityType) {
    return String.format("Invalid service entity type %s for %s", serviceEntity, entityType);
  }
}
