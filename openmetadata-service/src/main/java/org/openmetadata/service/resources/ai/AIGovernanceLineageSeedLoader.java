/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.util.List;
import java.util.regex.Pattern;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.LineageRepository;

@Slf4j
final class AIGovernanceLineageSeedLoader {
  private static final String ADMIN_USER = "admin";
  private static final String LINEAGE_DIR_PATTERN = ".*json/data/aiGovernance/lineage/.*\\.json$";
  private static final TypeReference<List<LineageSeed>> LINEAGE_SEED_TYPE =
      new TypeReference<>() {};

  private AIGovernanceLineageSeedLoader() {}

  static void loadFromResources() throws IOException {
    List<String> seedFiles = CommonUtil.getResources(Pattern.compile(LINEAGE_DIR_PATTERN));
    if (seedFiles.isEmpty()) {
      return;
    }
    ensureLineageRepository();
    for (String seedFile : seedFiles) {
      try {
        seedLineage(seedFile);
      } catch (Exception e) {
        LOG.warn("AI Governance lineage seed {} failed: {}", seedFile, e.getMessage(), e);
      }
    }
  }

  private static void seedLineage(String seedFile) throws IOException {
    String json =
        CommonUtil.getResourceAsStream(
            AIGovernanceLineageSeedLoader.class.getClassLoader(), seedFile);
    for (LineageSeed seed : JsonUtils.readValue(json, LINEAGE_SEED_TYPE)) {
      seedLineage(seed);
    }
  }

  private static void seedLineage(LineageSeed seed) {
    EntityReference from =
        Entity.getEntityReferenceByName(seed.getFromType(), seed.getFromFqn(), Include.ALL);
    EntityReference to =
        Entity.getEntityReferenceByName(seed.getToType(), seed.getToFqn(), Include.ALL);

    if (lineageExists(from, to)) {
      return;
    }

    LineageDetails lineageDetails =
        new LineageDetails()
            .withSource(LineageDetails.Source.MANUAL)
            .withDescription(seed.getDescription());
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from)
                    .withToEntity(to)
                    .withLineageDetails(lineageDetails));
    Entity.getLineageRepository().addLineage(addLineage, ADMIN_USER);
    LOG.info(
        "Seeded AI Governance lineage '{}.{}' -> '{}.{}'",
        seed.getFromType(),
        seed.getFromFqn(),
        seed.getToType(),
        seed.getToFqn());
  }

  private static boolean lineageExists(EntityReference from, EntityReference to) {
    CollectionDAO.EntityRelationshipObject existing =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .getRecord(from.getId(), to.getId(), Relationship.UPSTREAM.ordinal());
    return existing != null;
  }

  private static void ensureLineageRepository() {
    if (Entity.getLineageRepository() == null) {
      new LineageRepository();
    }
  }

  @Getter
  @Setter
  private static class LineageSeed {
    private String fromType;
    private String fromFqn;
    private String toType;
    private String toFqn;
    private String description;
  }
}
