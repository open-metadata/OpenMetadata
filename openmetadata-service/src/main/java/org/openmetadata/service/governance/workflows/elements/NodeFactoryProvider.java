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

package org.openmetadata.service.governance.workflows.elements;

import java.util.Map;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.service.governance.workflows.elements.NodeFactoryRegistry.NodeFactoryExtension;

/**
 * Supplies the node factories for subtypes that are defined in the OpenMetadata schema but
 * implemented by a distribution on the classpath. Implementations are listed in {@code
 * META-INF/services/org.openmetadata.service.governance.workflows.elements.NodeFactoryProvider} and
 * {@link NodeFactoryRegistry} registers their factories when it is first used, so every process
 * that builds a workflow, the server and {@code migrate} alike, can build their nodes.
 *
 * <p>An implementation only returns its factories. It must not call {@link
 * NodeFactoryRegistry#getInstance()}: the registry is still being created when it asks.
 * ADR:2026-11-18-workflow-node-factories-are-discovered-from-the-classpath
 */
public interface NodeFactoryProvider {

  Map<NodeSubType, NodeFactoryExtension> nodeFactories();
}
