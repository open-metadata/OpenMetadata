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
package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class RdfPollingJobNotifierTest {

  @Test
  void startStopFlipsRunningFlag() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.RdfIndexJobDAO jobDAO = mock(CollectionDAO.RdfIndexJobDAO.class);
    when(collectionDAO.rdfIndexJobDAO()).thenReturn(jobDAO);
    when(jobDAO.getRunningJobIds()).thenReturn(java.util.List.of());

    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "test-server-1234");
    assertFalse(notifier.isRunning());

    notifier.start();
    assertTrue(notifier.isRunning());

    notifier.stop();
    assertFalse(notifier.isRunning());
  }

  @Test
  void doubleStartIsSafe() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.RdfIndexJobDAO jobDAO = mock(CollectionDAO.RdfIndexJobDAO.class);
    when(collectionDAO.rdfIndexJobDAO()).thenReturn(jobDAO);
    when(jobDAO.getRunningJobIds()).thenReturn(java.util.List.of());

    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "test-server-1234");
    notifier.start();
    notifier.start(); // no-op, no exception
    assertTrue(notifier.isRunning());
    notifier.stop();
  }
}
