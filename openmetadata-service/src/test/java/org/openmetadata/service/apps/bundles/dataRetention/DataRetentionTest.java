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

package org.openmetadata.service.apps.bundles.dataRetention;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;
import org.openmetadata.schema.utils.JsonUtils;

class DataRetentionTest {
  @Test
  void zeroOrMissingRetentionMeansForever() {
    assertFalse(DataRetention.isRetentionEnabled(null));
    assertFalse(DataRetention.isRetentionEnabled(0));
    assertTrue(DataRetention.isRetentionEnabled(1));
  }

  /**
   * Installs upgraded from a release without workflowInstanceRetentionPeriod have it missing from
   * their stored configuration; it must read back as the 30-day default, not as null, which the app
   * would take to mean "keep forever" and silently never clean the run history.
   */
  @Test
  void workflowRunRetentionFallsBackToDefaultForConfigsSavedWithoutIt() {
    DataRetentionConfiguration config =
        JsonUtils.readValue(
            "{\"changeEventRetentionPeriod\": 7}", DataRetentionConfiguration.class);

    assertEquals(30, config.getWorkflowInstanceRetentionPeriod());
    assertTrue(DataRetention.isRetentionEnabled(config.getWorkflowInstanceRetentionPeriod()));
  }
}
