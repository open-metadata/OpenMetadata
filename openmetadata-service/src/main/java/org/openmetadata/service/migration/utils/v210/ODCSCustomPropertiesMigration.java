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

package org.openmetadata.service.migration.utils.v210;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.datacontract.odcs.ODCSCustomProperties;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecordWithId;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil;

/**
 * ODCS quality rules kept on a data contract, and in its version history, stored {@code
 * customProperties} as a key/value mapping. The model now reads the ODCS 3.1.0 list of {@code
 * {property, value}}, so a stored mapping would fail to load the contract or that version. Rewrites
 * both stores. Idempotent.
 */
@Slf4j
public final class ODCSCustomPropertiesMigration {
  private static final int BATCH_SIZE = 1_000;
  private static final String ODCS_QUALITY_RULES = "odcsQualityRules";
  private static final String ID = "id";

  private ODCSCustomPropertiesMigration() {}

  public static void convertODCSCustomPropertiesToLists(CollectionDAO collectionDAO) {
    int converted =
        convertODCSCustomPropertiesToLists(
            collectionDAO.dataContractDAO(), collectionDAO.entityExtensionDAO());
    LOG.info("Converted ODCS customProperties to lists in {} data contract row(s)", converted);
  }

  static int convertODCSCustomPropertiesToLists(
      EntityDAO<?> contractDAO, EntityExtensionDAO extensionDAO) {
    int converted = 0;
    List<String> batch = nextBatch(contractDAO, "", "");
    while (!batch.isEmpty()) {
      List<ObjectNode> contracts =
          batch.stream().map(json -> (ObjectNode) JsonUtils.readTree(json)).toList();
      converted += convertContracts(contractDAO, contracts);
      converted += convertVersions(extensionDAO, contracts);
      ObjectNode last = contracts.getLast();
      batch = nextBatch(contractDAO, last.path("name").asText(), last.path(ID).asText());
    }
    return converted;
  }

  private static List<String> nextBatch(
      EntityDAO<?> contractDAO, String afterName, String afterId) {
    return contractDAO.listAfter(new ListFilter(Include.ALL), BATCH_SIZE, afterName, afterId);
  }

  private static int convertContracts(EntityDAO<?> contractDAO, List<ObjectNode> contracts) {
    int converted = 0;
    for (ObjectNode contract : contracts) {
      if (convertQualityRules(contract)) {
        contractDAO.update(
            UUID.fromString(contract.path(ID).asText()),
            contract.path("fullyQualifiedName").asText(),
            contract.toString());
        converted++;
      }
    }
    return converted;
  }

  private static int convertVersions(EntityExtensionDAO extensionDAO, List<ObjectNode> contracts) {
    List<String> ids = contracts.stream().map(contract -> contract.path(ID).asText()).toList();
    String versionPrefix = EntityUtil.getVersionExtensionPrefix(Entity.DATA_CONTRACT);
    int converted = 0;
    for (ExtensionRecordWithId version : extensionDAO.getExtensionsBatch(ids, versionPrefix)) {
      ObjectNode snapshot = (ObjectNode) JsonUtils.readTree(version.extensionJson());
      if (convertQualityRules(snapshot)) {
        extensionDAO.insert(
            version.id(), version.extensionName(), Entity.DATA_CONTRACT, snapshot.toString());
        converted++;
      }
    }
    return converted;
  }

  static boolean convertQualityRules(ObjectNode contract) {
    boolean converted = false;
    JsonNode rules = contract.get(ODCS_QUALITY_RULES);
    if (rules != null && rules.isArray()) {
      for (JsonNode rule : rules) {
        // Stored contract JSON is read as a raw tree; a rule that is not an object is not ours.
        converted |=
            rule instanceof ObjectNode ruleObject
                && ODCSCustomProperties.toPropertyList(ruleObject);
      }
    }
    return converted;
  }
}
