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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.ContractValidation;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Regression tests for {@link DataContractRepository#validateContractWithoutThrowing}. The method
 * Javadoc promises to "collect all errors without throwing exceptions" and is the engine behind the
 * {@code POST /v1/dataContracts/validate} and {@code POST /v1/dataContracts/validate/yaml}
 * endpoints, which advertise a {@code 200 ContractValidation} for an invalid contract.
 *
 * <p>Before the fix, the standalone "schema details" call to {@code validateSchemaFieldsAgainstEntity}
 * — made *after* the guarded {@code prepareForValidation} call — escaped the method for two inputs:
 *
 * <ul>
 *   <li>Variant A: {@code entity == null} with a non-empty {@code schema} → {@code
 *       NullPointerException} on {@code entityRef.getType()} → HTTP 500.
 *   <li>Variant B: {@code entity} present but referencing a missing id (supported type) with a
 *       non-empty {@code schema} → {@code EntityNotFoundException} from {@code Entity.getEntity}
 *       → HTTP 404.
 * </ul>
 *
 * <p>These tests assert the method now honors its no-throw contract and returns a populated {@link
 * ContractValidation} for exactly those inputs. The {@link Entity} static collection DAO is set up
 * only to satisfy the repository constructor; {@code mockStatic(Entity.class)} is used solely for
 * Variant B to make the entity lookup throw.
 */
class DataContractValidateWithoutThrowingTest {

  private DataContractRepository repository;

  @BeforeEach
  void setUp() {
    Entity.setCollectionDAO(mock(CollectionDAO.class, RETURNS_DEEP_STUBS));
    repository = new DataContractRepository(new OpenMetadataApplicationConfig());
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  private DataContract contract(String name, EntityReference entity, List<Column> schema) {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName(name)
        .withEntity(entity)
        .withSchema(schema);
  }

  private List<Column> schema(ColumnDataType type) {
    return List.of(new Column().withName("a").withDataType(type));
  }

  @Test
  @DisplayName(
      "null entity with non-empty schema returns ContractValidation instead of throwing NPE (Variant A)")
  void nullEntityWithNonEmptySchema_returnsValidationWithoutThrowing() {
    DataContract dataContract = contract("c", null, schema(ColumnDataType.STRING));

    ContractValidation validation =
        assertDoesNotThrow(() -> repository.validateContractWithoutThrowing(dataContract));

    assertFalse(validation.getValid(), "an invalid contract must be reported as invalid");
    assertNotNull(
        validation.getEntityErrors(),
        "bean validation must diagnose the null entity before any domain validation");
    assertTrue(
        validation.getEntityErrors().stream().anyMatch(e -> e.contains("entity")),
        "entityErrors must include the @NotNull violation for entity: "
            + validation.getEntityErrors());
    assertNotNull(
        validation.getConstraintErrors(),
        "the previously-unguarded schema-details NPE must now be collected as a constraint error");
    assertFalse(validation.getConstraintErrors().isEmpty());
    assertNull(
        validation.getSchemaValidation(),
        "schemaValidation must stay null when the schema-details call throws before producing a result");
  }

  @Test
  @DisplayName(
      "non-existent entity id with non-empty schema returns ContractValidation instead of throwing "
          + "EntityNotFoundException (Variant B)")
  void missingEntityIdWithNonEmptySchema_returnsValidationWithoutThrowing() {
    DataContract dataContract =
        contract(
            "c",
            new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE),
            schema(ColumnDataType.STRING));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), any(UUID.class), anyString(), eq(Include.NON_DELETED)))
          .thenThrow(new EntityNotFoundException("table not found"));

      ContractValidation validation =
          assertDoesNotThrow(() -> repository.validateContractWithoutThrowing(dataContract));

      assertFalse(validation.getValid());
      assertNotNull(validation.getConstraintErrors());
      assertFalse(validation.getConstraintErrors().isEmpty());
      assertTrue(
          validation.getConstraintErrors().stream().anyMatch(e -> e.contains("table not found")),
          "the EntityNotFoundException must be recorded in constraintErrors: "
              + validation.getConstraintErrors());
      assertNull(
          validation.getSchemaValidation(),
          "schemaValidation must stay null when the entity lookup throws");
    }
  }

  @Test
  @DisplayName(
      "null entity with empty schema returns ContractValidation without throwing (control case)")
  void nullEntityWithoutSchema_returnsValidationWithoutThrowing() {
    // Empty schema short-circuits validateSchemaFieldsAgainstEntity before dereferencing the
    // (null) entity reference, so the schema-details call returns a blank SchemaValidation
    // instead of throwing — guaranteeing the no-throw contract for this input.
    DataContract dataContract = contract("c", null, null);

    ContractValidation validation =
        assertDoesNotThrow(() -> repository.validateContractWithoutThrowing(dataContract));

    assertFalse(validation.getValid());
    assertNotNull(validation.getEntityErrors());
    assertTrue(validation.getEntityErrors().stream().anyMatch(e -> e.contains("entity")));
    assertNotNull(
        validation.getSchemaValidation(),
        "empty schema must produce a blank SchemaValidation rather than throwing");
    assertEquals(0, validation.getSchemaValidation().getTotal());
    assertEquals(0, validation.getSchemaValidation().getFailed());
  }

  @Test
  @DisplayName(
      "valid contract with a present entity and empty schema remains valid (no regression on the "
          + "happy path)")
  void validContractWithPresentEntityAndEmptySchema_remainsValid() {
    // No Entity.getEntity lookup happens because the empty schema short-circuits the field
    // validation, so this case needs no Entity static mocking.
    DataContract dataContract =
        contract("c", new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE), null);

    ContractValidation validation =
        assertDoesNotThrow(() -> repository.validateContractWithoutThrowing(dataContract));

    assertTrue(validation.getValid(), "a well-formed contract with no schema must be valid");
    assertTrue(
        validation.getEntityErrors() == null || validation.getEntityErrors().isEmpty(),
        "entityErrors should be empty for a valid contract: " + validation.getEntityErrors());
    assertTrue(
        validation.getConstraintErrors() == null || validation.getConstraintErrors().isEmpty(),
        "constraintErrors should be empty for a valid contract: "
            + validation.getConstraintErrors());
  }
}
