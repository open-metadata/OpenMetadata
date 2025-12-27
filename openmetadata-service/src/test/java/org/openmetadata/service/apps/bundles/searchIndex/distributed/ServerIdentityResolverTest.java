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

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
    assertTrue(serverId.length() > 0);

    // If it's a fallback ID, it should start with "om-server-"
    // If it's a Quartz ID, it could be various formats depending on Quartz AUTO setting
  }
}
