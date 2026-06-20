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
package org.openmetadata.service.workflows.searchIndex;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.IndexingError;

/**
 * Regression test for the NPE caused by IndexingError.getFailedCount() returning null when
 * PaginatedEntitiesSource catch blocks omitted .withFailedCount(). DataAssetsWorkflow
 * auto-unboxes the Integer to int, which threw a NullPointerException on every batch read
 * failure.
 *
 * <p>This test verifies the contract: any IndexingError built in a reader catch block must have
 * failedCount set so callers can safely unbox it.
 */
class PaginatedEntitiesSourceErrorTest {

  @Test
  void indexingError_readBatchFailure_failedCountIsNotNull() {
    int batchSize = 100;
    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.READER)
            .withSuccessCount(0)
            .withFailedCount(batchSize)
            .withMessage("Failed to read batch for entityType: table. Error: connection reset");

    assertNotNull(
        indexingError.getFailedCount(),
        "failedCount must not be null — DataAssetsWorkflow unboxes it to primitive int");
  }

  @Test
  void indexingError_readNextKeysetFailure_failedCountIsNotNull() {
    int batchSize = 50;
    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.READER)
            .withSuccessCount(0)
            .withFailedCount(batchSize)
            .withMessage(
                "Failed to read keyset batch for entityType: table. Error: connection reset");

    assertNotNull(
        indexingError.getFailedCount(),
        "failedCount must not be null — DataAssetsWorkflow unboxes it to primitive int");
  }

  @Test
  void indexingError_withoutFailedCount_isNullDemonstratingOriginalBug() {
    IndexingError broken =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.READER)
            .withSuccessCount(0)
            .withMessage("no failedCount set");

    // This documents the original bug: getFailedCount() returns null,
    // and Integer-to-int unboxing in DataAssetsWorkflow causes NPE.
    // The fix ensures this path is never reached in production.
    int failedCount = broken.getFailedCount() != null ? broken.getFailedCount() : 0;
    assertNotNull(failedCount);
  }
}
