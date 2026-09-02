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

package org.openmetadata.service.apps.bundles.dataRetention;

import java.util.Objects;
import org.openmetadata.common.utils.CommonUtil;

/**
 * One batched cleanup contributed by a {@link DataRetentionExtension}. The DataRetention job runs
 * an extension's steps in list order, so a step whose rows are referenced by a later step's table
 * must come first.
 *
 * @param statsKey key this step's row counts are reported under in the job's entity stats, and the
 *     name it is logged with. Unique across all extensions.
 * @param deleter deletes one batch and reports how many rows went
 */
public record RetentionStep(String statsKey, BatchDeleter deleter) {

  public RetentionStep {
    if (CommonUtil.nullOrEmpty(statsKey)) {
      throw new IllegalArgumentException("A retention step needs a stats key");
    }
    Objects.requireNonNull(deleter, "Retention step '" + statsKey + "' needs a deleter");
  }

  @FunctionalInterface
  public interface BatchDeleter {

    /**
     * Deletes at most {@code batchSize} rows. Returning fewer than {@code batchSize} is what ends
     * the job's drain loop, so the delete must be bounded by {@code batchSize} — an implementation
     * that ignores it and always reports a full batch never terminates.
     *
     * @return the number of rows deleted
     */
    int deleteBatch(int batchSize);
  }
}
