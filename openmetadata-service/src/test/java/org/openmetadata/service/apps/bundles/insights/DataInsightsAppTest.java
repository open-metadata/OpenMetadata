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
package org.openmetadata.service.apps.bundles.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

class DataInsightsAppTest {

  @Test
  void createsDatabaseSafeLockOwnerFromLongQuartzFireInstanceId() {
    String fireInstanceId = "server-with-a-long-identity-1786858582985-1234567890";

    String lockJobId = DataInsightsApp.createJobLockId(fireInstanceId);

    assertEquals(36, lockJobId.length());
    assertNotEquals(fireInstanceId, lockJobId);
    assertEquals(lockJobId, DataInsightsApp.createJobLockId(fireInstanceId));
  }
}
