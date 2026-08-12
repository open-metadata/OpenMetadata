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

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;

/**
 * Registry for workflow node factories. Allows Collate to register implementations for node
 * subtypes that are defined in the OpenMetadata schema but implemented only in Collate.
 *
 * <p>This is a singleton. Use {@link #getInstance()} to access it.
 */
@Slf4j
public class NodeFactoryRegistry {

  private static final NodeFactoryRegistry INSTANCE = new NodeFactoryRegistry();

  private final Map<NodeSubType, NodeFactoryExtension> extensions = new ConcurrentHashMap<>();

  private NodeFactoryRegistry() {}

  public static NodeFactoryRegistry getInstance() {
    return INSTANCE;
  }

  public void register(NodeSubType subType, NodeFactoryExtension extension) {
    LOG.info("Registering workflow node factory for subtype: {}", subType);
    extensions.put(subType, extension);
  }

  public void deregister(NodeSubType subType) {
    extensions.remove(subType);
  }

  public Optional<NodeInterface> create(
      NodeSubType subType,
      WorkflowNodeDefinitionInterface nodeDefinition,
      WorkflowConfiguration config,
      String workflowDefinitionName) {
    NodeFactoryExtension ext = extensions.get(subType);
    if (ext == null) {
      LOG.warn("No workflow node factory registered for subtype: {}", subType);
      return Optional.empty();
    }
    return Optional.ofNullable(ext.create(nodeDefinition, config, workflowDefinitionName));
  }

  /** Factory interface for creating {@link NodeInterface} instances. */
  @FunctionalInterface
  public interface NodeFactoryExtension {
    NodeInterface create(
        WorkflowNodeDefinitionInterface nodeDefinition,
        WorkflowConfiguration config,
        String workflowDefinitionName);
  }
}
