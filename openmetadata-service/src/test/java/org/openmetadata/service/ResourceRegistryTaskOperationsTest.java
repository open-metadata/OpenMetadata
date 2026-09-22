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
package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ResourceDescriptor;

class ResourceRegistryTaskOperationsTest {

  @Test
  void common_operations_include_create_task_and_edit_task() {
    String resource = "resourceRegistryTaskTest";
    ResourceRegistry.addResource(resource, List.of(), Collections.emptySet());

    ResourceDescriptor descriptor = ResourceRegistry.getResourceDescriptor(resource);
    List<MetadataOperation> ops = descriptor.getOperations();

    assertTrue(
        ops.contains(MetadataOperation.CREATE_TASK),
        "CreateTask must be exposed on every entity so per-entity authz works");
    assertTrue(
        ops.contains(MetadataOperation.EDIT_TASK),
        "EditTask must be exposed on every entity so per-entity authz works");
  }
}
