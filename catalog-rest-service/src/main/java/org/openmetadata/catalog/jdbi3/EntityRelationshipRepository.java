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

package org.openmetadata.catalog.jdbi3;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.maven.shared.utils.io.IOUtil;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EntityRelationship;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.common.utils.CommonUtil;

@RequiredArgsConstructor
@Slf4j
public class EntityRelationshipRepository {
  @NonNull private final CollectionDAO daoCollection;

  /**
   * Initialize entity relationships from json files if seed data does not exist in corresponding tables. Seed data is
   * stored under catalog-rest-service/src/main/resources/json/data/relationship
   */
  public void initSeedDataFromResources() throws IOException {
    Pattern pattern = Pattern.compile(".*json/data/relationship/.*\\.json$");
    List<String> jsonDataFiles = CommonUtil.getResources(pattern);
    jsonDataFiles.forEach(
        jsonDataFile -> {
          try {
            String json =
                IOUtil.toString(Objects.requireNonNull(getClass().getClassLoader().getResourceAsStream(jsonDataFile)));
            initSeedData(JsonUtils.readValue(json, EntityRelationship.class));
          } catch (IOException e) {
            LOG.warn("Failed to initialize entity relationship from file {}: {}", jsonDataFile, e.getMessage());
          }
        });
  }

  /** Initialize the given relationship from seed data. */
  @Transaction
  public void initSeedData(@NonNull EntityRelationship entityRelationship) throws IOException {
    if (entityRelationship.getFromFQN() == null
        && entityRelationship.getToFQN() == null
        && entityRelationship.getFromId() != null
        && entityRelationship.getToId() != null) {
      LOG.info(
          "Ensuring relationship {}({}) --- {} ---> {}({})",
          entityRelationship.getFromEntity(),
          entityRelationship.getFromId(),
          entityRelationship.getRelation(),
          entityRelationship.getToEntity(),
          entityRelationship.getToId());
      addRelationship(
          entityRelationship.getFromId(),
          entityRelationship.getToId(),
          entityRelationship.getFromEntity(),
          entityRelationship.getToEntity(),
          entityRelationship.getRelationshipType());
      return;
    }
    if (entityRelationship.getFromFQN() != null
        && entityRelationship.getToFQN() != null
        && entityRelationship.getFromId() == null
        && entityRelationship.getToId() == null) {
      LOG.info(
          "Ensuring relationship {}({}) --- {} ---> {}({})",
          entityRelationship.getFromEntity(),
          entityRelationship.getFromFQN(),
          entityRelationship.getRelation(),
          entityRelationship.getToEntity(),
          entityRelationship.getToFQN());
      addRelationship(
          entityRelationship.getFromFQN(),
          entityRelationship.getToFQN(),
          entityRelationship.getFromEntity(),
          entityRelationship.getToEntity(),
          entityRelationship.getRelationshipType());
    }
  }

  public void addRelationship(UUID fromId, UUID toId, String fromEntity, String toEntity, Relationship relationship) {
    daoCollection.relationshipDAO().insert(fromId, toId, fromEntity, toEntity, relationship.ordinal());
  }

  public void addRelationship(
      String fromFQN, String toFQN, String fromEntity, String toEntity, Relationship relationship) throws IOException {
    EntityReference fromRef = Entity.getEntityReferenceByName(fromEntity, fromFQN);
    EntityReference toRef = Entity.getEntityReferenceByName(toEntity, toFQN);
    daoCollection
        .relationshipDAO()
        .insert(fromRef.getId(), toRef.getId(), fromEntity, toEntity, relationship.ordinal());
  }
}
