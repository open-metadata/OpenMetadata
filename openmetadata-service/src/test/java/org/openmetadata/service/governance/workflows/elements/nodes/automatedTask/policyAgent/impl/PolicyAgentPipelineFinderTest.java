/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.policyAgent.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;

@ExtendWith(MockitoExtension.class)
class PolicyAgentPipelineFinderTest {

  private static final String SERVICE_FQN = "snowflake_prod";

  @Mock private IngestionPipelineRepository repository;
  @Mock private ServiceEntityInterface service;

  @Test
  void testEmptyPipelineListReturnsEmpty() {
    when(service.getFullyQualifiedName()).thenReturn(SERVICE_FQN);
    when(repository.listAllByParentFqn(SERVICE_FQN)).thenReturn(List.of());

    assertTrue(PolicyAgentPipelineFinder.find(repository, service).isEmpty());
  }

  @Test
  void testPipelineWithWrongTypeReturnsEmpty() {
    when(service.getFullyQualifiedName()).thenReturn(SERVICE_FQN);
    when(repository.listAllByParentFqn(SERVICE_FQN))
        .thenReturn(List.of(pipelineJson(UUID.randomUUID(), PipelineType.METADATA)));

    assertTrue(PolicyAgentPipelineFinder.find(repository, service).isEmpty());
  }

  @Test
  void testPolicyAgentPipelineIsReturned() {
    UUID id = UUID.randomUUID();
    when(service.getFullyQualifiedName()).thenReturn(SERVICE_FQN);
    when(service.getEntityReference()).thenReturn(serviceRef());
    when(repository.listAllByParentFqn(SERVICE_FQN))
        .thenReturn(List.of(pipelineJson(id, PipelineType.POLICY_AGENT)));

    Optional<IngestionPipeline> result = PolicyAgentPipelineFinder.find(repository, service);

    assertTrue(result.isPresent());
    assertEquals(id, result.get().getId());
  }

  @Test
  void testServiceReferenceIsSetOnReturnedPipeline() {
    EntityReference ref = serviceRef();
    when(service.getFullyQualifiedName()).thenReturn(SERVICE_FQN);
    when(service.getEntityReference()).thenReturn(ref);
    when(repository.listAllByParentFqn(SERVICE_FQN))
        .thenReturn(List.of(pipelineJson(UUID.randomUUID(), PipelineType.POLICY_AGENT)));

    Optional<IngestionPipeline> result = PolicyAgentPipelineFinder.find(repository, service);

    assertTrue(result.isPresent());
    assertEquals(ref, result.get().getService());
  }

  @Test
  void testFirstPolicyAgentPipelineIsReturnedWhenMultipleExist() {
    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    when(service.getFullyQualifiedName()).thenReturn(SERVICE_FQN);
    when(service.getEntityReference()).thenReturn(serviceRef());
    when(repository.listAllByParentFqn(SERVICE_FQN))
        .thenReturn(
            List.of(
                pipelineJson(firstId, PipelineType.POLICY_AGENT),
                pipelineJson(secondId, PipelineType.POLICY_AGENT)));

    Optional<IngestionPipeline> result = PolicyAgentPipelineFinder.find(repository, service);

    assertTrue(result.isPresent());
    assertEquals(firstId, result.get().getId());
  }

  @Test
  void testPolicyAgentPipelineFoundAmongMixedTypes() {
    UUID policyId = UUID.randomUUID();
    when(service.getFullyQualifiedName()).thenReturn(SERVICE_FQN);
    when(service.getEntityReference()).thenReturn(serviceRef());
    when(repository.listAllByParentFqn(SERVICE_FQN))
        .thenReturn(
            List.of(
                pipelineJson(UUID.randomUUID(), PipelineType.METADATA),
                pipelineJson(UUID.randomUUID(), PipelineType.USAGE),
                pipelineJson(policyId, PipelineType.POLICY_AGENT)));

    Optional<IngestionPipeline> result = PolicyAgentPipelineFinder.find(repository, service);

    assertTrue(result.isPresent());
    assertEquals(policyId, result.get().getId());
  }

  @Test
  void testAllNonPolicyAgentPipelinesReturnsEmpty() {
    when(service.getFullyQualifiedName()).thenReturn(SERVICE_FQN);
    when(repository.listAllByParentFqn(SERVICE_FQN))
        .thenReturn(
            List.of(
                pipelineJson(UUID.randomUUID(), PipelineType.METADATA),
                pipelineJson(UUID.randomUUID(), PipelineType.USAGE)));

    assertFalse(PolicyAgentPipelineFinder.find(repository, service).isPresent());
  }

  // ---- helpers ----

  private static String pipelineJson(UUID id, PipelineType type) {
    return JsonUtils.pojoToJson(new IngestionPipeline().withId(id).withPipelineType(type));
  }

  private static EntityReference serviceRef() {
    return new EntityReference().withId(UUID.randomUUID()).withName(SERVICE_FQN);
  }
}
