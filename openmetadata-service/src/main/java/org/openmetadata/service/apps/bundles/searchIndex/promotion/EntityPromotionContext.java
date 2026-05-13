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
package org.openmetadata.service.apps.bundles.searchIndex.promotion;

/**
 * Per-entity record-level counts used to decide whether to promote a staged index. Built from
 * {@code SearchIndexJob.EntityTypeStats} at finalize time. Kept deliberately small — the policy
 * should not need to reach back into the executor for additional signals.
 */
public record EntityPromotionContext(
    String entityType,
    long totalRecords,
    long successRecords,
    long failedRecords,
    long processedRecords) {

  /**
   * Fraction of records that landed in the staged index. Defaults to {@code 1.0} when nothing
   * was scheduled (empty entity types are not failures).
   */
  public double successRatio() {
    if (totalRecords <= 0) {
      return 1.0;
    }
    return (double) successRecords / totalRecords;
  }

  /**
   * Returns true if every scheduled record was accounted for (either succeeded or failed). A
   * job that stopped early — e.g. operator stop, partition reclaimer, host crash — leaves
   * {@code processedRecords < totalRecords} and must NOT be flagged fully successful even if
   * the success ratio over the processed subset clears the threshold.
   */
  public boolean allRecordsAccountedFor() {
    if (totalRecords <= 0) {
      return true;
    }
    long accounted = Math.max(processedRecords, successRecords + failedRecords);
    return accounted >= totalRecords;
  }
}
