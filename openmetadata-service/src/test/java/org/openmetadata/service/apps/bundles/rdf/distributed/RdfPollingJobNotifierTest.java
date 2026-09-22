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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
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

  @Test
  void pollFiresCallbackExactlyOncePerNewlyObservedRunningJob() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.RdfIndexJobDAO jobDAO = mock(CollectionDAO.RdfIndexJobDAO.class);
    when(collectionDAO.rdfIndexJobDAO()).thenReturn(jobDAO);
    UUID jobId = UUID.randomUUID();
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(jobId.toString()));

    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "server-abcdef12");
    AtomicInteger callbackCount = new AtomicInteger();
    AtomicReference<UUID> observedJob = new AtomicReference<>();
    notifier.onJobStarted(
        id -> {
          callbackCount.incrementAndGet();
          observedJob.set(id);
        });
    getRunningFlag(notifier).set(true);

    invokePoll(notifier);
    invokePoll(notifier);

    assertEquals(1, callbackCount.get());
    assertEquals(jobId, observedJob.get());
    assertTrue(getKnownJobs(notifier).contains(jobId));
  }

  @Test
  void pollDropsCompletedJobsFromKnownSet() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.RdfIndexJobDAO jobDAO = mock(CollectionDAO.RdfIndexJobDAO.class);
    when(collectionDAO.rdfIndexJobDAO()).thenReturn(jobDAO);
    UUID jobId = UUID.randomUUID();
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(jobId.toString()), List.of());

    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "server-abcdef12");
    getRunningFlag(notifier).set(true);

    invokePoll(notifier);
    assertTrue(getKnownJobs(notifier).contains(jobId));

    invokePoll(notifier);
    assertTrue(getKnownJobs(notifier).isEmpty());
  }

  @Test
  void selfStartedJobIsNotReNotifiedWhenParticipating() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.RdfIndexJobDAO jobDAO = mock(CollectionDAO.RdfIndexJobDAO.class);
    when(collectionDAO.rdfIndexJobDAO()).thenReturn(jobDAO);
    UUID jobId = UUID.randomUUID();
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(jobId.toString()));

    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "server-abcdef12");
    AtomicInteger callbackCount = new AtomicInteger();
    notifier.onJobStarted(id -> callbackCount.incrementAndGet());
    getRunningFlag(notifier).set(true);

    notifier.notifyJobStarted(jobId);
    notifier.setParticipating(true);
    assertTrue(getParticipatingFlag(notifier).get());

    invokePoll(notifier);

    assertEquals(0, callbackCount.get());
    assertTrue(getKnownJobs(notifier).contains(jobId));
  }

  @Test
  void setParticipatingTogglesParticipatingFlagWithoutStart() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "server-abcdef12");

    assertFalse(getParticipatingFlag(notifier).get());

    notifier.setParticipating(true);
    assertTrue(getParticipatingFlag(notifier).get());

    notifier.setParticipating(false);
    assertFalse(getParticipatingFlag(notifier).get());
  }

  @Test
  void notifyJobStartedSuppressesCallbackWhileNotifyJobCompletedAllowsRediscovery()
      throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.RdfIndexJobDAO jobDAO = mock(CollectionDAO.RdfIndexJobDAO.class);
    when(collectionDAO.rdfIndexJobDAO()).thenReturn(jobDAO);
    UUID jobId = UUID.randomUUID();
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(jobId.toString()));

    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "server-abcdef12");
    AtomicInteger callbackCount = new AtomicInteger();
    notifier.onJobStarted(id -> callbackCount.incrementAndGet());
    getRunningFlag(notifier).set(true);

    notifier.notifyJobStarted(jobId);
    assertTrue(getKnownJobs(notifier).contains(jobId));
    assertEquals(0, callbackCount.get());

    invokePoll(notifier);
    assertEquals(0, callbackCount.get());

    notifier.notifyJobCompleted(jobId);
    assertFalse(getKnownJobs(notifier).contains(jobId));
    assertEquals(0, callbackCount.get());

    invokePoll(notifier);
    assertEquals(1, callbackCount.get());
  }

  @Test
  void pollReturnsEarlyWithoutQueryingDaoWhenNotRunning() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    RdfPollingJobNotifier notifier = new RdfPollingJobNotifier(collectionDAO, "server-abcdef12");
    AtomicInteger callbackCount = new AtomicInteger();
    notifier.onJobStarted(id -> callbackCount.incrementAndGet());

    invokePoll(notifier);

    assertEquals(0, callbackCount.get());
    assertTrue(getKnownJobs(notifier).isEmpty());
  }

  private void invokePoll(RdfPollingJobNotifier notifier) throws Exception {
    Method method = notifier.getClass().getDeclaredMethod("pollForJobs");
    method.setAccessible(true);
    method.invoke(notifier);
  }

  @SuppressWarnings("unchecked")
  private Set<UUID> getKnownJobs(RdfPollingJobNotifier notifier) throws Exception {
    return (Set<UUID>) getField(notifier, "knownJobs");
  }

  private AtomicBoolean getRunningFlag(RdfPollingJobNotifier notifier) throws Exception {
    return (AtomicBoolean) getField(notifier, "running");
  }

  private AtomicBoolean getParticipatingFlag(RdfPollingJobNotifier notifier) throws Exception {
    return (AtomicBoolean) getField(notifier, "participating");
  }

  private Object getField(Object target, String name) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }
}
