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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * Regression tests for {@link DataContractRepository#validateContractWithEffective}. The method is
 * the one {@code POST /v1/dataContracts/{id}/validate} must call so that validation runs against
 * the *effective* contract's rules (which may include properties inherited from a Data Product)
 * while every result row and the {@code latestResult} PATCH are staged on the *requested* contract
 * — the one the caller authorized against.
 *
 * <p>Before the fix the endpoint passed the effective contract straight into {@code
 * validateContract(...)}, which keys the result time series by the contract's FQN and PATCHes
 * {@code latestResult} via its id. When the entity-end lookup ({@code getEffectiveDataContract})
 * returned a *different* contract row than the authorized id (the {@code LIMIT 1} entity-wide
 * query has no {@code ORDER BY}), runs were silently reparented onto that other contract.
 *
 * <p>These tests pin the contract {@code validateContractWithEffective} upholds: the result time
 * series is written keyed by {@code contractForResults.getFullyQualifiedName()} and never by the
 * effective contract's, even when the two are distinct objects. The {@link Entity} static
 * collection DAO only needs to satisfy the repository constructor and to provide the time series
 * DAO the method writes through; the rest of {@code updateLatestResult} fails through the deep-stub
 * DAOs and is swallowed inside that method, so the routing assertions stay on the writes that
 * escape the method.
 */
class DataContractValidateRoutingTest {

  private DataContractRepository repository;
  private TimeSeriesDAOs.EntityExtensionTimeSeriesDAO timeSeriesDAO;

  @BeforeEach
  void setUp() {
    // A plain (non-deep-stub) mock so insert(...) calls can be verified and their FQN captured.
    // entityExtensionTimeSeriesDao() returns EntityExtensionTimeSeriesDAO (which extends
    // EntityTimeSeriesDAO); the result writes go through EntityTimeSeriesDAO's default methods.
    timeSeriesDAO = mock(TimeSeriesDAOs.EntityExtensionTimeSeriesDAO.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    when(collectionDAO.entityExtensionTimeSeriesDao()).thenReturn(timeSeriesDAO);
    Entity.setCollectionDAO(collectionDAO);
    repository = new DataContractRepository(new OpenMetadataApplicationConfig());
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  private DataContract contract(String fqn, String name) {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(fqn)
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE))
        // No schema/semantics/sla/qualityExpectations so the validation stays off the DAOs and the
        // SLA validator short-circuits to null. latestResult is null so abortRunningValidation is
        // a no-op, keeping insert(...) keys attributable solely to the result writes under test.
        .withLatestResult(null);
  }

  @Test
  @DisplayName(
      "result time series is keyed by the requested contract's FQN, never the effective contract's")
  void resultsAreStoredOnContractForResults_notOnEffectiveContract() {
    String requestedFqn = "svc.db.schema.table.dataContract_requested";
    String effectiveFqn = "svc.db.schema.table.dataContract_effective";
    DataContract contractForResults = contract(requestedFqn, "requested");
    DataContract effectiveContract = contract(effectiveFqn, "effective");

    PutResponse<DataContractResult> response =
        repository.validateContractWithEffective(contractForResults, effectiveContract);
    DataContractResult result = response.getEntity();

    // The HTTP response carries the FQN the caller will see; it must name the contract they asked
    // to validate, not the one the entity-wide lookup resolved.
    assertEquals(
        requestedFqn,
        result.getDataContractFQN(),
        "the result must be attributed to the requested contract");

    // The result time series is keyed by FQN (entityFQNHash). Every insert must be under the
    // requested contract's FQN; a write under the effective contract's FQN is the misroute this
    // method exists to prevent. The method inserts at least once (a Running row, then the final).
    verify(timeSeriesDAO, atLeastOnce())
        .insert(eq(requestedFqn), anyString(), anyString(), anyString());
    verify(timeSeriesDAO, never()).insert(eq(effectiveFqn), anyString(), anyString(), anyString());
    assertFalse(
        result.getDataContractFQN().contains("effective"),
        "the effective contract's FQN must not leak into the stored result");
  }

  @Test
  @DisplayName("results extension name is preserved when routing to the requested contract")
  void resultsExtensionIsPreserved() {
    String requestedFqn = "svc.db.schema.table.dataContract_ext_check";
    DataContract contractForResults = contract(requestedFqn, "ext_check");
    // Effective and requested are the same object: the single-contract happy path. It must route
    // to that contract's FQN and use the canonical data-contract result extension/schema.
    PutResponse<DataContractResult> response =
        repository.validateContractWithEffective(contractForResults, contractForResults);

    assertEquals(requestedFqn, response.getEntity().getDataContractFQN());
    verify(timeSeriesDAO, atLeastOnce())
        .insert(
            eq(requestedFqn),
            eq(DataContractRepository.RESULT_EXTENSION),
            eq(DataContractRepository.RESULT_SCHEMA),
            anyString());
    assertTrue(
        response.getEntity().getContractExecutionStatus() != null,
        "a validation result must always carry an execution status");
  }
}
