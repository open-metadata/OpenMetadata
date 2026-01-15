/*
 *  Copyright 2021 Collate
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

package org.openmetadata.operator.unit;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.operator.model.OMJobPhase;

/**
 * Unit tests for OMJobPhase enum.
 */
class OMJobPhaseTest {

  @Test
  void testTerminalPhases() {
    assertTrue(OMJobPhase.SUCCEEDED.isTerminal());
    assertTrue(OMJobPhase.FAILED.isTerminal());

    assertFalse(OMJobPhase.PENDING.isTerminal());
    assertFalse(OMJobPhase.RUNNING.isTerminal());
    assertFalse(OMJobPhase.EXIT_HANDLER_RUNNING.isTerminal());
  }

  @Test
  void testValidTransitions() {
    // From PENDING
    assertTrue(OMJobPhase.PENDING.canTransitionTo(OMJobPhase.RUNNING));
    assertTrue(OMJobPhase.PENDING.canTransitionTo(OMJobPhase.FAILED));
    assertFalse(OMJobPhase.PENDING.canTransitionTo(OMJobPhase.EXIT_HANDLER_RUNNING));
    assertFalse(OMJobPhase.PENDING.canTransitionTo(OMJobPhase.SUCCEEDED));

    // From RUNNING
    assertTrue(OMJobPhase.RUNNING.canTransitionTo(OMJobPhase.EXIT_HANDLER_RUNNING));
    assertTrue(OMJobPhase.RUNNING.canTransitionTo(OMJobPhase.FAILED));
    assertFalse(OMJobPhase.RUNNING.canTransitionTo(OMJobPhase.PENDING));
    assertFalse(OMJobPhase.RUNNING.canTransitionTo(OMJobPhase.SUCCEEDED));

    // From EXIT_HANDLER_RUNNING
    assertTrue(OMJobPhase.EXIT_HANDLER_RUNNING.canTransitionTo(OMJobPhase.SUCCEEDED));
    assertTrue(OMJobPhase.EXIT_HANDLER_RUNNING.canTransitionTo(OMJobPhase.FAILED));
    assertFalse(OMJobPhase.EXIT_HANDLER_RUNNING.canTransitionTo(OMJobPhase.PENDING));
    assertFalse(OMJobPhase.EXIT_HANDLER_RUNNING.canTransitionTo(OMJobPhase.RUNNING));

    // Terminal phases cannot transition
    assertFalse(OMJobPhase.SUCCEEDED.canTransitionTo(OMJobPhase.FAILED));
    assertFalse(OMJobPhase.FAILED.canTransitionTo(OMJobPhase.SUCCEEDED));
  }

  @Test
  void testNextPhase() {
    assertEquals(OMJobPhase.RUNNING, OMJobPhase.PENDING.getNextPhase());
    assertEquals(OMJobPhase.EXIT_HANDLER_RUNNING, OMJobPhase.RUNNING.getNextPhase());
    assertEquals(OMJobPhase.SUCCEEDED, OMJobPhase.EXIT_HANDLER_RUNNING.getNextPhase());

    assertNull(OMJobPhase.SUCCEEDED.getNextPhase());
    assertNull(OMJobPhase.FAILED.getNextPhase());
  }

  @Test
  void testStringValues() {
    assertEquals("Pending", OMJobPhase.PENDING.getValue());
    assertEquals("Running", OMJobPhase.RUNNING.getValue());
    assertEquals("ExitHandlerRunning", OMJobPhase.EXIT_HANDLER_RUNNING.getValue());
    assertEquals("Succeeded", OMJobPhase.SUCCEEDED.getValue());
    assertEquals("Failed", OMJobPhase.FAILED.getValue());

    assertEquals("Pending", OMJobPhase.PENDING.toString());
    assertEquals("Running", OMJobPhase.RUNNING.toString());
  }
}
