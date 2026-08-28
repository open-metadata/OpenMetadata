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

package org.openmetadata.service.governance.workflows.elements;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;

/**
 * Tests for {@link NodeFactoryRegistry}. Tests run in a fixed order because the registry is a
 * singleton and state is shared across tests in the same JVM.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class NodeFactoryRegistryTest {

  @Test
  @Order(1)
  void testGetInstanceIsNonNull() {
    assertNotNull(NodeFactoryRegistry.getInstance());
  }

  @Test
  @Order(2)
  void testGetInstanceReturnsSameSingleton() {
    assertSame(NodeFactoryRegistry.getInstance(), NodeFactoryRegistry.getInstance());
  }

  @AfterAll
  static void cleanupRegistry() {
    NodeFactoryRegistry.getInstance().deregister(NodeSubType.POLICY_AGENT_TASK);
  }

  @Test
  @Order(3)
  void testCreateReturnsEmptyForUnregisteredSubtype() {
    // POLICY_AGENT_TASK is not registered in OSS — the handler lives in Collate.
    Optional<NodeInterface> result =
        NodeFactoryRegistry.getInstance()
            .create(NodeSubType.POLICY_AGENT_TASK, null, null, "TestWorkflow");

    assertTrue(result.isEmpty());
  }

  @Test
  @Order(4)
  void testRegisterAndCreateReturnsNode() {
    NodeInterface mockNode = (model, process) -> {};

    NodeFactoryRegistry.getInstance()
        .register(NodeSubType.POLICY_AGENT_TASK, (def, cfg, name) -> mockNode);

    Optional<NodeInterface> result =
        NodeFactoryRegistry.getInstance()
            .create(NodeSubType.POLICY_AGENT_TASK, null, null, "TestWorkflow");

    assertTrue(result.isPresent());
    assertSame(mockNode, result.get());
  }
}
