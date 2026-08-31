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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.sql.Types;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.type.RelationshipTypeUsage;
import org.openmetadata.sdk.services.ontology.RelationshipTypeService;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class GlossaryTermRelationUsageIT {
  private static final String DEFAULT_RELATION_TYPE = "relatedTo";

  @Test
  void countByRelationTypeIncludesLegacyUntypedRelations(TestNamespace ns) {
    RelationshipTypeService relationshipTypes = SdkClients.adminClient().relationshipTypes();
    RelationshipType relatedTo = relationshipTypes.getByName(DEFAULT_RELATION_TYPE);
    RelationshipType customType = relationshipTypes.create(customRelationshipType(ns));
    UUID typedFromId = UUID.randomUUID();
    UUID legacyFromId = UUID.randomUUID();
    UUID defaultFromId = UUID.randomUUID();
    String fromEntity = "legacyUsageFrom_" + ns.uniqueShortId();
    String toEntity = "legacyUsageTo_" + ns.uniqueShortId();

    try {
      insertRelationship(
          typedFromId, fromEntity, toEntity, customType.getName(), customType.getId());
      insertRelationship(legacyFromId, fromEntity, toEntity, customType.getName(), null);
      insertRelationship(defaultFromId, fromEntity, toEntity, "", null);

      List<RelationshipTypeUsage> usages =
          Entity.getCollectionDAO()
              .relationshipDAO()
              .countByRelationType(fromEntity, toEntity, Relationship.RELATED_TO.ordinal());
      List<RelationshipTypeUsage> customUsages = usagesFor(customType.getName(), usages);
      List<RelationshipTypeUsage> defaultUsages = usagesFor(DEFAULT_RELATION_TYPE, usages);

      assertEquals(1, customUsages.size());
      assertEquals(2, customUsages.get(0).getCount());
      assertEquals(customType.getId(), customUsages.get(0).getRelationshipType().getId());
      assertEquals(1, defaultUsages.size());
      assertEquals(1, defaultUsages.get(0).getCount());
      assertEquals(relatedTo.getId(), defaultUsages.get(0).getRelationshipType().getId());
    } finally {
      try {
        deleteRelationships(List.of(typedFromId, legacyFromId, defaultFromId));
      } finally {
        relationshipTypes.delete(customType.getId().toString(), true);
      }
    }
  }

  private static CreateRelationshipType customRelationshipType(TestNamespace ns) {
    String name = "legacyUsage_" + ns.uniqueShortId();
    URI predicate = URI.create("https://example.org/ontology/" + name);
    return new CreateRelationshipType()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Relationship type used to verify legacy usage counts")
        .withIri(predicate)
        .withRdfPredicate(predicate)
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC))
        .withCrossGlossaryAllowed(true)
        .withPaletteKey(RelationshipPaletteKey.VIOLET);
  }

  private static void insertRelationship(
      UUID fromId,
      String fromEntity,
      String toEntity,
      String relationType,
      UUID relationshipTypeId) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              Update update =
                  handle
                      .createUpdate(
                          "INSERT INTO entity_relationship "
                              + "(fromId, toId, fromEntity, toEntity, relation, relationType, relationshipTypeId) "
                              + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation, :relationType, :relationshipTypeId)")
                      .bind("fromId", fromId.toString())
                      .bind("toId", UUID.randomUUID().toString())
                      .bind("fromEntity", fromEntity)
                      .bind("toEntity", toEntity)
                      .bind("relation", Relationship.RELATED_TO.ordinal())
                      .bind("relationType", relationType);
              if (relationshipTypeId == null) {
                update.bindNull("relationshipTypeId", Types.VARCHAR);
              } else {
                update.bind("relationshipTypeId", relationshipTypeId.toString());
              }
              update.execute();
            });
  }

  private static void deleteRelationships(List<UUID> fromIds) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM entity_relationship WHERE fromId IN (<fromIds>)")
                    .bindList("fromIds", fromIds.stream().map(UUID::toString).toList())
                    .execute());
  }

  private static List<RelationshipTypeUsage> usagesFor(
      String name, List<RelationshipTypeUsage> usages) {
    return usages.stream()
        .filter(usage -> name.equals(usage.getRelationshipType().getName()))
        .toList();
  }
}
