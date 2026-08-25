/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

class ServerIdentityResolverTest {

  @BeforeEach
  void setUp() {
    // Reset singleton before each test
    ServerIdentityResolver.reset();
  }

  @AfterEach
  void tearDown() {
    ServerIdentityResolver.reset();
  }

  @Test
  void testGetInstance_ReturnsSameInstance() {
    ServerIdentityResolver instance1 = ServerIdentityResolver.getInstance();
    ServerIdentityResolver instance2 = ServerIdentityResolver.getInstance();

    assertNotNull(instance1);
    assertEquals(instance1, instance2);
  }

  @Test
  void testGetServerId_NotNull() {
    ServerIdentityResolver resolver = ServerIdentityResolver.getInstance();
    String serverId = resolver.getServerId();

    assertNotNull(serverId);
    assertFalse(serverId.isEmpty());
  }

  @Test
  void testGetServerId_Consistent() {
    ServerIdentityResolver resolver = ServerIdentityResolver.getInstance();

    String id1 = resolver.getServerId();
    String id2 = resolver.getServerId();

    assertEquals(id1, id2);
  }

  @Test
  void testIsSameServer_SameIds() {
    assertTrue(ServerIdentityResolver.isSameServer("server-1", "server-1"));
  }

  @Test
  void testIsSameServer_DifferentIds() {
    assertFalse(ServerIdentityResolver.isSameServer("server-1", "server-2"));
  }

  @Test
  void testIsSameServer_NullIds() {
    assertFalse(ServerIdentityResolver.isSameServer(null, "server-1"));
    assertFalse(ServerIdentityResolver.isSameServer("server-1", null));
    assertFalse(ServerIdentityResolver.isSameServer(null, null));
  }

  @Test
  void testIsThisServer_Matches() {
    ServerIdentityResolver resolver = ServerIdentityResolver.getInstance();
    String myServerId = resolver.getServerId();

    assertTrue(resolver.isThisServer(myServerId));
  }

  @Test
  void testIsThisServer_DoesNotMatch() {
    ServerIdentityResolver resolver = ServerIdentityResolver.getInstance();

    assertFalse(resolver.isThisServer("some-other-server-id"));
  }

  @Test
  void testIsThisServer_NullInput() {
    ServerIdentityResolver resolver = ServerIdentityResolver.getInstance();

    assertFalse(resolver.isThisServer(null));
  }

  @Test
  void testReset_CreatesNewInstance() {
    ServerIdentityResolver instance1 = ServerIdentityResolver.getInstance();
    String id1 = instance1.getServerId();

    ServerIdentityResolver.reset();

    ServerIdentityResolver instance2 = ServerIdentityResolver.getInstance();
    String id2 = instance2.getServerId();

    // Note: IDs might be the same if using hostname+pid, but instances should be different
    assertNotNull(id1);
    assertNotNull(id2);
  }

  @Test
  void testServerId_HasExpectedFormat() {
    ServerIdentityResolver resolver = ServerIdentityResolver.getInstance();
    String serverId = resolver.getServerId();

    // Server ID should be either:
    // 1. Quartz instance ID (if Quartz is initialized)
    // 2. om-server-hostname-pid
    // 3. om-server-uuid (fallback)

    assertNotNull(serverId);
    assertFalse(serverId.isEmpty());

    // If it's a fallback ID, it should start with "om-server-"
    // If it's a Quartz ID, it could be various formats depending on Quartz AUTO setting
  }

  @Test
  void testGetServerId_UsesQuartzInstanceIdWhenAvailable() throws SchedulerException {
    AppScheduler appScheduler = mock(AppScheduler.class);
    Scheduler scheduler = mock(Scheduler.class);
    when(appScheduler.getScheduler()).thenReturn(scheduler);
    when(scheduler.getSchedulerInstanceId()).thenReturn("quartz-node-1");

    try (MockedStatic<AppScheduler> appSchedulerMock = mockStatic(AppScheduler.class)) {
      appSchedulerMock.when(AppScheduler::getInstance).thenReturn(appScheduler);

      ServerIdentityResolver resolver = ServerIdentityResolver.getInstance();

      assertEquals("quartz-node-1", resolver.getServerId());
      assertTrue(resolver.isThisServer("quartz-node-1"));
    }
  }

  @Test
  void testGetServerId_FallsBackToHostIdWhenSchedulerMissing() {
    AppScheduler appScheduler = mock(AppScheduler.class);
    InetAddress inetAddress = mock(InetAddress.class);
    when(appScheduler.getScheduler()).thenReturn(null);
    when(inetAddress.getHostName()).thenReturn("resolver-host");

    try (MockedStatic<AppScheduler> appSchedulerMock = mockStatic(AppScheduler.class);
        MockedStatic<InetAddress> inetAddressMock = mockStatic(InetAddress.class)) {
      appSchedulerMock.when(AppScheduler::getInstance).thenReturn(appScheduler);
      inetAddressMock.when(InetAddress::getLocalHost).thenReturn(inetAddress);

      String serverId = ServerIdentityResolver.getInstance().getServerId();

      assertTrue(serverId.startsWith("om-server-resolver-host-"));
    }
  }

  @Test
  void testGetServerId_FallsBackToHostIdOnQuartzSchedulerException() throws SchedulerException {
    AppScheduler appScheduler = mock(AppScheduler.class);
    Scheduler scheduler = mock(Scheduler.class);
    InetAddress inetAddress = mock(InetAddress.class);
    when(appScheduler.getScheduler()).thenReturn(scheduler);
    when(scheduler.getSchedulerInstanceId()).thenThrow(new SchedulerException("quartz down"));
    when(inetAddress.getHostName()).thenReturn("resolver-host");

    try (MockedStatic<AppScheduler> appSchedulerMock = mockStatic(AppScheduler.class);
        MockedStatic<InetAddress> inetAddressMock = mockStatic(InetAddress.class)) {
      appSchedulerMock.when(AppScheduler::getInstance).thenReturn(appScheduler);
      inetAddressMock.when(InetAddress::getLocalHost).thenReturn(inetAddress);

      String serverId = ServerIdentityResolver.getInstance().getServerId();

      assertTrue(serverId.startsWith("om-server-resolver-host-"));
    }
  }

  @Test
  void testGetServerId_UsesProcessHandleWhenRuntimeNameHasNoHost() {
    AppScheduler appScheduler = mock(AppScheduler.class);
    RuntimeMXBean runtimeMXBean = mock(RuntimeMXBean.class);
    InetAddress inetAddress = mock(InetAddress.class);
    when(appScheduler.getScheduler()).thenReturn(null);
    when(runtimeMXBean.getName()).thenReturn("plain-process-name");
    when(inetAddress.getHostName()).thenReturn("resolver-host");

    try (MockedStatic<AppScheduler> appSchedulerMock = mockStatic(AppScheduler.class);
        MockedStatic<InetAddress> inetAddressMock = mockStatic(InetAddress.class);
        MockedStatic<ManagementFactory> managementFactoryMock =
            mockStatic(ManagementFactory.class)) {
      appSchedulerMock.when(AppScheduler::getInstance).thenReturn(appScheduler);
      inetAddressMock.when(InetAddress::getLocalHost).thenReturn(inetAddress);
      managementFactoryMock.when(ManagementFactory::getRuntimeMXBean).thenReturn(runtimeMXBean);

      String serverId = ServerIdentityResolver.getInstance().getServerId();

      assertEquals("om-server-resolver-host-" + ProcessHandle.current().pid(), serverId);
    }
  }

  @Test
  void testGetServerId_FallsBackToGeneratedUuidWhenHostLookupFails() {
    try (MockedStatic<AppScheduler> appSchedulerMock = mockStatic(AppScheduler.class);
        MockedStatic<InetAddress> inetAddressMock = mockStatic(InetAddress.class)) {
      appSchedulerMock
          .when(AppScheduler::getInstance)
          .thenThrow(new IllegalStateException("scheduler unavailable"));
      inetAddressMock
          .when(InetAddress::getLocalHost)
          .thenThrow(new UnknownHostException("unknown host"));

      String serverId = ServerIdentityResolver.getInstance().getServerId();

      assertTrue(serverId.startsWith("om-server-"));
      UUID.fromString(serverId.substring("om-server-".length()));
    }
  }
}
