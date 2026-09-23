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

package org.openmetadata.service.events.scheduled;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.util.PostCommitActionQueue;

/** An alert's job follows the commit of the unit of work that changed its row. */
class AlertJobsTest {
  private final UUID alertId = UUID.randomUUID();

  @AfterEach
  void closeTheUnitOfWork() {
    PostCommitActionQueue.clear();
  }

  @Test
  void convergesOnlyOnceTheUnitOfWorkCommits() {
    try (MockedStatic<AlertJobs> jobs = mockStatic(AlertJobs.class, CALLS_REAL_METHODS)) {
      jobs.when(() -> AlertJobs.converge(any())).thenAnswer(ask -> null);
      PostCommitActionQueue.begin();

      AlertJobs.convergeAfterCommit(alertId);
      jobs.verify(() -> AlertJobs.converge(alertId), never());

      PostCommitActionQueue.run(PostCommitActionQueue.drain());
      jobs.verify(() -> AlertJobs.converge(alertId));
    }
  }

  @Test
  void aUnitOfWorkThatRollsBackConvergesNothing() {
    try (MockedStatic<AlertJobs> jobs = mockStatic(AlertJobs.class, CALLS_REAL_METHODS)) {
      jobs.when(() -> AlertJobs.converge(any())).thenAnswer(ask -> null);
      PostCommitActionQueue.begin();

      AlertJobs.convergeAfterCommit(alertId);
      PostCommitActionQueue.clear();

      jobs.verify(() -> AlertJobs.converge(alertId), never());
    }
  }

  // With no unit of work open, the row is already committed.
  @Test
  void withNoUnitOfWorkItConvergesAtOnce() {
    try (MockedStatic<AlertJobs> jobs = mockStatic(AlertJobs.class, CALLS_REAL_METHODS)) {
      jobs.when(() -> AlertJobs.converge(any())).thenAnswer(ask -> null);

      AlertJobs.convergeAfterCommit(alertId);

      jobs.verify(() -> AlertJobs.converge(alertId));
    }
  }
}
