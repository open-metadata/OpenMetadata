/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
package org.openmetadata.service.workflows.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EntityError;

/**
 * Validates the stale-relationship classification used by reindex readers. The matcher must
 * recognise the {@code ensureSingleRelationship} message ("does not have expected relationship
 * parentOf to/from entity type ...") that surfaces during indexing of orphaned time-series records
 * (e.g. {@code testCaseResolutionStatus} rows whose parentOf row was lost in the 1.4.0 migration).
 */
class ReindexingUtilStaleRelationshipTest {

  private static final String RELATIONSHIP_NOT_FOUND_MESSAGE =
      "Entity type testCaseResolutionStatus 7c5c3c4d-3a82-4d8c-9c4a-3e2c9b9b0d5b "
          + "does not have expected relationship parentOf to/from entity type testCase";

  private static final String ENTITY_NOT_FOUND_MESSAGE =
      "EntityNotFoundException: Instance for testCase with id abc not found";

  private static final String REAL_ERROR_MESSAGE =
      "JsonProcessingException: Unexpected character at line 12";

  @Test
  void isStaleReferenceError_recognisesRelationshipNotFoundMessage() {
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage(RELATIONSHIP_NOT_FOUND_MESSAGE)));
  }

  @Test
  void isStaleReferenceError_recognisesEntityNotFoundException() {
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage(ENTITY_NOT_FOUND_MESSAGE)));
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("Instance for testCase with id ... ")));
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("Resource does not exist anymore")));
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("Entity not found for query params [name=foo].")));
  }

  @Test
  void isStaleReferenceError_recognisesEveryEntityNotFoundExceptionFactory() {
    // Mirrors the exact message constants in EntityNotFoundException — every byX(...) factory
    // must be classified as a stale-reference warning, not a real failure.
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("Entity with id [abc-123] not found.")));
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("Entity with name [my-table] not found.")));
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError()
                .withMessage("Entity with id [abc-123] and version [0.2] not found.")));
    assertTrue(
        ReindexingUtil.isStaleReferenceError(
            new EntityError()
                .withMessage("Parser schema not found for entity with id [abc-123].")));
  }

  @Test
  void isStaleReferenceError_doesNotMatchBareNotFoundOrUnrelatedMessages() {
    assertFalse(
        ReindexingUtil.isStaleReferenceError(new EntityError().withMessage(REAL_ERROR_MESSAGE)));
    assertFalse(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("Database connection refused")));
    assertFalse(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("Column 'status' not found in result set")));
    assertFalse(
        ReindexingUtil.isStaleReferenceError(
            new EntityError().withMessage("SSL certificate not found")));
    assertFalse(ReindexingUtil.isStaleReferenceError(null));
    assertFalse(ReindexingUtil.isStaleReferenceError(new EntityError()));
  }

  @Test
  void partitionErrors_throwsOnNullWarningsOut() {
    org.junit.jupiter.api.Assertions.assertThrows(
        NullPointerException.class,
        () -> ReindexingUtil.partitionErrors(List.of(new EntityError().withMessage("x")), null));
  }

  @Test
  void partitionErrors_separatesStaleRelationshipsFromRealErrors() {
    List<EntityError> errors =
        List.of(
            new EntityError().withMessage(RELATIONSHIP_NOT_FOUND_MESSAGE).withEntity("tcrs-1"),
            new EntityError().withMessage(ENTITY_NOT_FOUND_MESSAGE).withEntity("tcrs-2"),
            new EntityError().withMessage(REAL_ERROR_MESSAGE).withEntity("tcrs-3"));

    List<EntityError> warnings = new ArrayList<>();
    List<EntityError> realErrors = ReindexingUtil.partitionErrors(errors, warnings);

    assertEquals(2, warnings.size());
    assertEquals(1, realErrors.size());
    assertEquals("tcrs-3", realErrors.get(0).getEntity());
  }

  @Test
  void partitionErrors_handlesEmptyAndNullInput() {
    List<EntityError> warnings = new ArrayList<>();
    assertTrue(ReindexingUtil.partitionErrors(null, warnings).isEmpty());
    assertTrue(warnings.isEmpty());

    assertTrue(ReindexingUtil.partitionErrors(List.of(), warnings).isEmpty());
    assertTrue(warnings.isEmpty());
  }
}
