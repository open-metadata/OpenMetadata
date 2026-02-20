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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;

class SinkProviderRegistryTest {

  private static final String TEST_SINK_TYPE = "testSink";
  private SinkProviderRegistry registry;

  @BeforeEach
  void setUp() {
    registry = SinkProviderRegistry.getInstance();
    // Clean up any existing registrations for test isolation
    registry.unregister(TEST_SINK_TYPE);
  }

  @AfterEach
  void tearDown() {
    registry.unregister(TEST_SINK_TYPE);
  }

  @Test
  void testSingletonInstance() {
    SinkProviderRegistry instance1 = SinkProviderRegistry.getInstance();
    SinkProviderRegistry instance2 = SinkProviderRegistry.getInstance();
    assertEquals(instance1, instance2, "Registry should be a singleton");
  }

  @Test
  void testRegisterAndCreate() {
    // Create a mock provider
    SinkProvider mockProvider = createMockProvider();

    // Register the factory
    registry.register(TEST_SINK_TYPE, config -> mockProvider);

    // Verify registration
    assertTrue(registry.isRegistered(TEST_SINK_TYPE));
    assertTrue(registry.getRegisteredTypes().contains(TEST_SINK_TYPE));

    // Create provider instance
    Optional<SinkProvider> created = registry.create(TEST_SINK_TYPE, null);
    assertTrue(created.isPresent());
    assertEquals(mockProvider, created.get());
  }

  @Test
  void testUnregister() {
    SinkProvider mockProvider = createMockProvider();
    registry.register(TEST_SINK_TYPE, config -> mockProvider);

    assertTrue(registry.isRegistered(TEST_SINK_TYPE));

    registry.unregister(TEST_SINK_TYPE);

    assertFalse(registry.isRegistered(TEST_SINK_TYPE));
    assertFalse(registry.getRegisteredTypes().contains(TEST_SINK_TYPE));
  }

  @Test
  void testCreateUnregisteredType() {
    Optional<SinkProvider> result = registry.create("nonExistentSink", null);
    assertFalse(result.isPresent());
  }

  @Test
  void testCreateWithConfig() {
    String expectedConfig = "testConfig";
    SinkProvider mockProvider = createMockProvider();

    registry.register(
        TEST_SINK_TYPE,
        config -> {
          assertEquals(expectedConfig, config, "Config should be passed to factory");
          return mockProvider;
        });

    Optional<SinkProvider> created = registry.create(TEST_SINK_TYPE, expectedConfig);
    assertTrue(created.isPresent());
  }

  @Test
  void testMultipleRegistrations() {
    String sinkType1 = "sink1";
    String sinkType2 = "sink2";

    SinkProvider provider1 = createMockProvider();
    SinkProvider provider2 = createMockProvider();

    try {
      registry.register(sinkType1, config -> provider1);
      registry.register(sinkType2, config -> provider2);

      assertTrue(registry.isRegistered(sinkType1));
      assertTrue(registry.isRegistered(sinkType2));
      assertEquals(provider1, registry.create(sinkType1, null).orElse(null));
      assertEquals(provider2, registry.create(sinkType2, null).orElse(null));
    } finally {
      registry.unregister(sinkType1);
      registry.unregister(sinkType2);
    }
  }

  private SinkProvider createMockProvider() {
    SinkProvider provider = mock(SinkProvider.class);
    when(provider.getSinkType()).thenReturn(TEST_SINK_TYPE);
    when(provider.write(
            org.mockito.ArgumentMatchers.any(SinkContext.class),
            org.mockito.ArgumentMatchers.any(EntityInterface.class)))
        .thenReturn(SinkResult.builder().success(true).syncedCount(1).build());
    when(provider.writeBatch(
            org.mockito.ArgumentMatchers.any(SinkContext.class),
            org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(SinkResult.builder().success(true).syncedCount(1).build());
    return provider;
  }
}
