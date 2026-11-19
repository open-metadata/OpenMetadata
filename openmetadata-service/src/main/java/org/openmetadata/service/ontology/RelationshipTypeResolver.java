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

import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;

public final class RelationshipTypeResolver {
  private final CollectionDAO.RelationshipTypeDAO relationshipTypeDAO;

  public RelationshipTypeResolver(final CollectionDAO.RelationshipTypeDAO relationshipTypeDAO) {
    this.relationshipTypeDAO = relationshipTypeDAO;
  }

  public RelationshipType require(final String name) {
    final RelationshipType relationshipType;
    try {
      relationshipType = relationshipTypeDAO.findEntityByName(name, Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      throw unavailable(name, () -> relationshipTypeDAO.findEntityByName(name, Include.ALL));
    }
    return relationshipType;
  }

  public RelationshipType require(final UUID id) {
    final RelationshipType relationshipType;
    try {
      relationshipType = relationshipTypeDAO.findEntityById(id, Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      throw unavailable(id.toString(), () -> relationshipTypeDAO.findEntityById(id, Include.ALL));
    }
    return relationshipType;
  }

  /**
   * Names a soft-deleted type as one to restore, the same message a relationship type write gives
   * for a reference to it, and any other type as unknown.
   */
  private static BadRequestException unavailable(
      final String key, final Supplier<RelationshipType> includingDeleted) {
    RelationshipType stored;
    try {
      stored = includingDeleted.get();
    } catch (EntityNotFoundException notStored) {
      stored = null;
    }
    return new BadRequestException(
        stored == null
            ? "Relationship type '" + key + "' is not registered"
            : "Relationship type '" + stored.getName() + "' is deleted; restore it first");
  }

  public RelationshipType requireIgnoreCase(final String name) {
    final RelationshipType relationshipType =
        list().stream()
            .filter(type -> type.getName().equalsIgnoreCase(name))
            .findFirst()
            .orElseThrow(
                () ->
                    new BadRequestException("Relationship type '" + name + "' is not registered"));
    return relationshipType;
  }

  public String inverseName(final String name) {
    final RelationshipType relationshipType = require(name);
    final String inverseName =
        relationshipType.getInverse() == null ? null : relationshipType.getInverse().getName();
    return inverseName;
  }

  public RelationshipType findByPredicate(final URI predicate) {
    final String json =
        predicate == null ? null : relationshipTypeDAO.findByPredicate(predicate.toString());
    final RelationshipType relationshipType =
        json == null ? null : JsonUtils.readValue(json, RelationshipType.class);
    return relationshipType;
  }

  public List<RelationshipType> list() {
    return relationshipTypeDAO.listActive().stream()
        .map(json -> JsonUtils.readValue(json, RelationshipType.class))
        .toList();
  }

  public boolean isTransitive(final URI predicate) {
    final RelationshipType relationshipType = findByPredicate(predicate);
    final boolean isTransitive =
        relationshipType != null
            && relationshipType.getCharacteristics() != null
            && relationshipType
                .getCharacteristics()
                .contains(RelationshipCharacteristic.TRANSITIVE);
    return isTransitive;
  }

  public boolean isSimple(final URI predicate) {
    final RelationshipType relationshipType = findByPredicate(predicate);
    final boolean isSimple =
        relationshipType == null
            || (!hasCharacteristic(relationshipType, RelationshipCharacteristic.TRANSITIVE)
                && (relationshipType.getPropertyChain() == null
                    || relationshipType.getPropertyChain().isEmpty()));
    return isSimple;
  }

  private static boolean hasCharacteristic(
      final RelationshipType relationshipType, final RelationshipCharacteristic characteristic) {
    return relationshipType.getCharacteristics() != null
        && relationshipType.getCharacteristics().contains(characteristic);
  }
}
