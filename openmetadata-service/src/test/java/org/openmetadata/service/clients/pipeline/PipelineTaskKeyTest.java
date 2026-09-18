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

package org.openmetadata.service.clients.pipeline;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.sdk.PipelineServiceClientInterface;

/**
 * Guards the log task key lookup. A pipeline type missing from {@code TYPE_TO_TASK} used to yield a
 * null map key in the log response, which Jackson rejects — the caller saw an opaque
 * {@code 400 Invalid request format} instead of their logs.
 */
class PipelineTaskKeyTest {

  @ParameterizedTest
  @EnumSource(PipelineType.class)
  void everyPipelineTypeHasATaskKey(PipelineType pipelineType) {
    assertNotNull(
        PipelineServiceClientInterface.TYPE_TO_TASK.get(pipelineType.toString()),
        "PipelineType." + pipelineType.name() + " has no TYPE_TO_TASK entry");
  }

  @ParameterizedTest
  @EnumSource(PipelineType.class)
  void taskKeyOfNeverReturnsNull(PipelineType pipelineType) {
    assertNotNull(PipelineServiceClientInterface.taskKeyOf(pipelineType.toString()));
  }

  /**
   * Call sites are split between the two accessors — K8sPipelineClient passes {@code value()} while
   * the resource layer and AirflowRESTClient pass {@code toString()}. They agree today only because
   * the generated enum's toString() returns the JSON value; if that ever diverges, K8s log keys
   * would silently change. Pin the equivalence rather than rely on it.
   */
  @ParameterizedTest
  @EnumSource(PipelineType.class)
  void bothAccessorFormsResolveToTheSameTaskKey(PipelineType pipelineType) {
    String fromValue = PipelineServiceClientInterface.taskKeyOf(pipelineType.value());
    String fromToString = PipelineServiceClientInterface.taskKeyOf(pipelineType.toString());

    assertNotNull(fromValue, "PipelineType." + pipelineType.name() + " unresolved via value()");
    assertEquals(
        fromToString,
        fromValue,
        "value() and toString() disagree for PipelineType." + pipelineType.name());
  }

  /** The map is keyed by the JSON value, so value() must hit a real entry, not the fallback. */
  @ParameterizedTest
  @EnumSource(PipelineType.class)
  void everyPipelineTypeHasATaskKeyByValue(PipelineType pipelineType) {
    assertNotNull(
        PipelineServiceClientInterface.TYPE_TO_TASK.get(pipelineType.value()),
        "PipelineType." + pipelineType.name() + " has no TYPE_TO_TASK entry for value()");
  }

  @Test
  void taskKeyOfFallsBackForUnmappedType() {
    assertEquals(
        PipelineServiceClientInterface.DEFAULT_TASK_KEY,
        PipelineServiceClientInterface.taskKeyOf("someTypeAddedLater"));
  }

  @Test
  void policyAgentLogsUseTheKeyTheUiReads() {
    // agentsDataMapper.ts maps PipelineType.PolicyAgent -> 'ingestion_task'.
    assertEquals(
        "ingestion_task",
        PipelineServiceClientInterface.taskKeyOf(PipelineType.POLICY_AGENT.toString()));
  }

  /** The failure mode this class guards against, pinned so the regression is unmistakable. */
  @Test
  void nullTaskKeyBreaksLogResponseSerialization() {
    Map<String, String> logResponse = new HashMap<>();
    logResponse.put(null, "log line");

    assertThrows(
        JsonMappingException.class, () -> new ObjectMapper().writeValueAsString(logResponse));
  }

  @Test
  void logResponseKeyedByPolicyAgentTaskSerializes() throws Exception {
    Map<String, String> logResponse = new HashMap<>();
    logResponse.put(
        PipelineServiceClientInterface.taskKeyOf(PipelineType.POLICY_AGENT.toString()), "log line");

    String json = new ObjectMapper().writeValueAsString(logResponse);

    assertEquals("{\"ingestion_task\":\"log line\"}", json);
  }
}
