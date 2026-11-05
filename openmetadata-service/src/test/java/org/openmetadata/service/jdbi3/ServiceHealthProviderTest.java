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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType.FAILED;
import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType.PARTIAL_SUCCESS;
import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType.QUEUED;
import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType.RUNNING;
import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType.STOPPED;
import static org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType.SUCCESS;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.ServiceHealth;

/**
 * The worst-wins reduction is the contract the Connections UI implemented client-side before health
 * moved to the server. These cases pin that contract so the two definitions cannot drift.
 */
class ServiceHealthProviderTest {

  @Test
  void serviceWithNoPipelinesIsNotRun() {
    assertEquals(ServiceHealth.NOT_RUN, ServiceHealthProvider.worstOf(List.of()));
  }

  @Test
  void nonTerminalStatesAloneAreNotRun() {
    assertEquals(
        ServiceHealth.NOT_RUN, ServiceHealthProvider.worstOf(List.of(QUEUED, RUNNING, STOPPED)));
  }

  @Test
  void singleTerminalStateMapsDirectly() {
    assertEquals(ServiceHealth.SUCCESS, ServiceHealthProvider.worstOf(List.of(SUCCESS)));
    assertEquals(
        ServiceHealth.PARTIAL_SUCCESS, ServiceHealthProvider.worstOf(List.of(PARTIAL_SUCCESS)));
    assertEquals(ServiceHealth.FAILED, ServiceHealthProvider.worstOf(List.of(FAILED)));
  }

  @Test
  void failedBeatsEverything() {
    assertEquals(ServiceHealth.FAILED, ServiceHealthProvider.worstOf(List.of(SUCCESS, FAILED)));
    assertEquals(ServiceHealth.FAILED, ServiceHealthProvider.worstOf(List.of(FAILED, SUCCESS)));
    assertEquals(
        ServiceHealth.FAILED,
        ServiceHealthProvider.worstOf(List.of(SUCCESS, PARTIAL_SUCCESS, FAILED)));
  }

  @Test
  void partialSuccessBeatsSuccess() {
    assertEquals(
        ServiceHealth.PARTIAL_SUCCESS,
        ServiceHealthProvider.worstOf(List.of(SUCCESS, PARTIAL_SUCCESS)));
    assertEquals(
        ServiceHealth.PARTIAL_SUCCESS,
        ServiceHealthProvider.worstOf(List.of(PARTIAL_SUCCESS, SUCCESS)));
  }

  @Test
  void nonTerminalStatesNeverMaskATerminalOne() {
    assertEquals(
        ServiceHealth.SUCCESS, ServiceHealthProvider.worstOf(List.of(RUNNING, SUCCESS, QUEUED)));
    assertEquals(
        ServiceHealth.FAILED, ServiceHealthProvider.worstOf(List.of(RUNNING, FAILED, STOPPED)));
  }
}
