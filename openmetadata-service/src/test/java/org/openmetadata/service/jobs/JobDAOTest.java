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

package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.junit.jupiter.api.Test;

class JobDAOTest {
  private static final String ONTOLOGY_BULK_FILTER = "'ONTOLOGY_BULK'";
  private static final String RUNNING_FILTER = "status = 'RUNNING'";
  private static final String STALENESS_FILTER = "updatedAt < :staleBefore";

  @Test
  void staleWorkerRecoveryIsHeartbeatScopedAndIncludesOntologyJobs() throws NoSuchMethodException {
    final Method method =
        JobDAO.class.getMethod("markStaleRunningJobsFailed", long.class, long.class);
    final SqlUpdate update = method.getAnnotation(SqlUpdate.class);

    assertNotNull(update);
    assertTrue(update.value().contains(ONTOLOGY_BULK_FILTER));
    assertTrue(update.value().contains(RUNNING_FILTER));
    assertTrue(update.value().contains(STALENESS_FILTER));
    assertEquals(2, method.getParameterCount());
  }
}
