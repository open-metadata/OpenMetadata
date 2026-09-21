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

package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * The mirror of the test-case table filter: {@code filterByEntityNameDataContractBelongsTo} scopes a
 * data-contract alert to the assets the contract covers. It only ever read the change-event payload,
 * so a conversation on a data contract could never match the filter its own alert carries, while the
 * three other scoping filters on the same form resolve the feed subject (#30571).
 */
class AlertsRuleEvaluatorDataContractFilterTest {

  private static final String COVERED_TABLE = "service.db.schema.orders";
  private static final String OTHER_TABLE = "service.db.schema.shipments";
  private static final UUID CONTRACT_ID = UUID.randomUUID();

  @Test
  void dataContractEvent_coveringListedEntity_matches() {
    assertTrue(matchesEntity(contractOn(COVERED_TABLE), COVERED_TABLE));
  }

  @Test
  void dataContractEvent_coveringAnotherEntity_doesNotMatch() {
    assertFalse(matchesEntity(contractOn(OTHER_TABLE), COVERED_TABLE));
  }

  @Test
  void dataContractEvent_withIdOnlyEntityReference_doesNotMatch() {
    DataContract createdFromUi = contractOn(COVERED_TABLE);
    createdFromUi.getEntity().setFullyQualifiedName(null);
    assertFalse(matchesEntity(createdFromUi, COVERED_TABLE));
  }

  @Test
  void nonDataContractEntityEvent_doesNotMatch() {
    ChangeEvent event =
        new ChangeEvent()
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(Entity.TABLE)
            .withEntity(JsonUtils.pojoToJson(contractOn(COVERED_TABLE)));
    assertFalse(
        new AlertsRuleEvaluator(event)
            .filterByEntityNameDataContractBelongsTo(List.of(COVERED_TABLE)));
  }

  @Test
  void conversationOnContractCoveringListedEntity_matches() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(contractRef()));
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubContractRead(entityMock, contractOn(COVERED_TABLE));
      assertTrue(evaluator.filterByEntityNameDataContractBelongsTo(List.of(COVERED_TABLE)));
    }
  }

  @Test
  void conversationOnContractCoveringAnotherEntity_doesNotMatch() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(contractRef()));
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubContractRead(entityMock, contractOn(OTHER_TABLE));
      assertFalse(evaluator.filterByEntityNameDataContractBelongsTo(List.of(COVERED_TABLE)));
    }
  }

  @Test
  void conversationWhoseContractNoLongerResolves_doesNotMatch() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(contractRef()));
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stubContractRead(entityMock, null);
      assertFalse(evaluator.filterByEntityNameDataContractBelongsTo(List.of(COVERED_TABLE)));
    }
  }

  @Test
  void conversationAboutANonContractEntity_doesNotMatch() {
    EntityReference tableRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TABLE)
            .withFullyQualifiedName(COVERED_TABLE);
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(tableRef));
    assertFalse(evaluator.filterByEntityNameDataContractBelongsTo(List.of(COVERED_TABLE)));
  }

  @Test
  void conversationWithoutASubject_doesNotMatch() {
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(conversationAbout(null));
    assertFalse(evaluator.filterByEntityNameDataContractBelongsTo(List.of(COVERED_TABLE)));
  }

  // ---------- fixtures ----------

  private static DataContract contractOn(String tableFqn) {
    return new DataContract()
        .withId(CONTRACT_ID)
        .withName("contract")
        .withEntity(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.TABLE)
                .withFullyQualifiedName(tableFqn));
  }

  /** The evaluator resolves the payload class through the registry the runtime populates at boot. */
  private static boolean matchesEntity(DataContract dataContract, String listedEntityFqn) {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock
          .when(() -> Entity.getEntityClassFromType(Entity.DATA_CONTRACT))
          .thenReturn(DataContract.class);
      return new AlertsRuleEvaluator(contractEvent(dataContract))
          .filterByEntityNameDataContractBelongsTo(List.of(listedEntityFqn));
    }
  }

  /** The non-feed path parses the serialized payload, which is how it arrives on the wire. */
  private static ChangeEvent contractEvent(DataContract dataContract) {
    return new ChangeEvent()
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(Entity.DATA_CONTRACT)
        .withEntityId(dataContract.getId())
        .withEntity(JsonUtils.pojoToJson(dataContract));
  }

  private static EntityReference contractRef() {
    return new EntityReference()
        .withId(CONTRACT_ID)
        .withType(Entity.DATA_CONTRACT)
        .withFullyQualifiedName("contract");
  }

  private static ChangeEvent conversationAbout(EntityReference subject) {
    Thread conversation =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withMessage("is this still accurate?")
            .withEntityRef(subject);
    return new ChangeEvent()
        .withEventType(EventType.THREAD_CREATED)
        .withEntityType(Entity.THREAD)
        .withEntity(conversation);
  }

  private static void stubContractRead(MockedStatic<Entity> entityMock, DataContract stored) {
    entityMock
        .when(
            () ->
                Entity.getEntityOrNull(any(EntityReference.class), eq(""), eq(Include.NON_DELETED)))
        .thenReturn(stored);
  }
}
