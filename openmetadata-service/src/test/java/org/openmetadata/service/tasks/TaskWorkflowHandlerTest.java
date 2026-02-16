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

package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

/**
 * Unit tests for TaskWorkflowHandler.
 *
 * <p>These tests verify the singleton pattern and basic functionality of TaskWorkflowHandler
 * without requiring the full OpenMetadata application context.
 */
class TaskWorkflowHandlerTest {

  @Test
  void testSingletonInstance() {
    TaskWorkflowHandler instance1 = TaskWorkflowHandler.getInstance();
    TaskWorkflowHandler instance2 = TaskWorkflowHandler.getInstance();

    assertNotNull(instance1);
    assertSame(instance1, instance2, "getInstance should return the same instance");
  }

  @Test
  void testInstanceNotNull() {
    TaskWorkflowHandler handler = TaskWorkflowHandler.getInstance();
    assertNotNull(handler);
  }
}
