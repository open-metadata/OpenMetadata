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

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.PolicyAgentTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.gateway.ParallelGatewayDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.startEvent.StartEventDefinition;
import org.openmetadata.service.governance.workflows.elements.nodes.endEvent.EndEvent;
import org.openmetadata.service.governance.workflows.elements.nodes.gateway.ParallelGateway;
import org.openmetadata.service.governance.workflows.elements.nodes.startEvent.StartEvent;

class NodeFactoryTest {

  static final WorkflowConfiguration CFG = new WorkflowConfiguration().withStoreStageStatus(false);

  /** No-op stub returned by the registry for POLICY_AGENT_TASK in these tests. */
  private static final NodeInterface STUB = (model, process) -> {};

  @BeforeEach
  void registerPolicyAgentStub() {
    // Register a no-op stub so POLICY_AGENT_TASK tests are independent of whether
    // NodeFactoryRegistryTest has already run in this JVM.
    NodeFactoryRegistry.getInstance()
        .register(NodeSubType.POLICY_AGENT_TASK, (def, cfg, name) -> STUB);
  }

  @AfterEach
  void deregisterPolicyAgentStub() {
    NodeFactoryRegistry.getInstance().deregister(NodeSubType.POLICY_AGENT_TASK);
  }

  // ---- POLICY_AGENT_TASK — Collate extension point ----

  @Test
  void testPolicyAgentTaskDelegatesToRegistry() {
    PolicyAgentTaskDefinition def = new PolicyAgentTaskDefinition().withName("agent");

    NodeInterface result = NodeFactory.createNode(def, CFG, "DataAccessRequestTaskWorkflow");

    // NodeFactory must return exactly the node the registry provided — no wrapping.
    assertSame(STUB, result);
  }

  @Test
  void testPolicyAgentTaskThrowsWhenRegistryReturnsEmpty() {
    NodeFactoryRegistry registry = NodeFactoryRegistry.getInstance();
    registry.deregister(NodeSubType.POLICY_AGENT_TASK);
    try {
      PolicyAgentTaskDefinition def = new PolicyAgentTaskDefinition().withName("agent");
      assertThrows(
          IllegalStateException.class,
          () -> NodeFactory.createNode(def, CFG, "DataAccessRequestTaskWorkflow"));
    } finally {
      registry.register(NodeSubType.POLICY_AGENT_TASK, (d, c, n) -> STUB);
    }
  }

  // ---- Core node routing ----

  @Test
  void testStartEventCreatesStartEvent() {
    StartEventDefinition def = new StartEventDefinition().withName("start");

    NodeInterface node = NodeFactory.createNode(def, CFG, "TestWorkflow");

    assertInstanceOf(StartEvent.class, node);
  }

  @Test
  void testEndEventCreatesEndEvent() {
    EndEventDefinition def = new EndEventDefinition().withName("end");

    NodeInterface node = NodeFactory.createNode(def, CFG, "TestWorkflow");

    assertInstanceOf(EndEvent.class, node);
  }

  @Test
  void testParallelGatewayCreatesParallelGateway() {
    ParallelGatewayDefinition def = new ParallelGatewayDefinition().withName("split");

    NodeInterface node = NodeFactory.createNode(def, CFG, "TestWorkflow");

    assertInstanceOf(ParallelGateway.class, node);
  }
}
