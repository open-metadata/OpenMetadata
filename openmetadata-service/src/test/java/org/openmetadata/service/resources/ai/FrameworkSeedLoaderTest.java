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

package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIFrameworkControlRepository;
import org.openmetadata.service.jdbi3.AIGovernanceFrameworkRepository;
import org.openmetadata.service.util.FullyQualifiedName;

class FrameworkSeedLoaderTest {

  @Test
  void sameControlNameIsSeededOncePerFramework() throws Exception {
    AIFrameworkControlRepository repository = mock(AIFrameworkControlRepository.class);
    Map<String, AIFrameworkControl> persistedControls = new HashMap<>();
    when(repository.findByNameOrNull(anyString(), eq(Include.ALL)))
        .thenAnswer(invocation -> persistedControls.get(invocation.getArgument(0)));
    when(repository.create(isNull(), any(AIFrameworkControl.class)))
        .thenAnswer(
            invocation -> {
              AIFrameworkControl control = invocation.getArgument(1);
              persistedControls.put(control.getFullyQualifiedName(), control);
              return control;
            });
    JsonNode controls = JsonUtils.readTree("[{\"name\":\"shared-control\"}]");
    EntityReference firstFramework = framework("framework-one");
    EntityReference secondFramework = framework("framework-two");
    EntityReference dottedFramework = framework("framework.with.dot");

    FrameworkSeedLoader.seedControls(controls, firstFramework, repository);
    FrameworkSeedLoader.seedControls(controls, firstFramework, repository);
    FrameworkSeedLoader.seedControls(controls, secondFramework, repository);
    FrameworkSeedLoader.seedControls(controls, dottedFramework, repository);

    assertEquals(3, persistedControls.size());
    assertEquals(
        firstFramework, persistedControls.get("framework-one.shared-control").getFramework());
    assertEquals(
        secondFramework, persistedControls.get("framework-two.shared-control").getFramework());
    assertEquals(
        dottedFramework,
        persistedControls.get("\"framework.with.dot\".shared-control").getFramework());
    verify(repository, times(3)).create(isNull(), any(AIFrameworkControl.class));
  }

  @Test
  void concurrentDuplicateControlIsRecovered() throws Exception {
    // A second replica inserts the control between our existence check and create(), so the
    // pre-check misses (null) but create() trips the fqnHash unique constraint. The re-fetch
    // then finds the row another instance wrote, and seeding must continue without failing.
    AIFrameworkControlRepository repository = mock(AIFrameworkControlRepository.class);
    when(repository.findByNameOrNull(eq("gov.c1"), eq(Include.ALL)))
        .thenReturn(null)
        .thenReturn(new AIFrameworkControl().withName("c1"));
    when(repository.create(isNull(), any(AIFrameworkControl.class)))
        .thenThrow(new UnableToExecuteStatementException("duplicate key value (fqnhash)"));
    JsonNode controls = JsonUtils.readTree("[{\"name\":\"c1\"}]");

    assertDoesNotThrow(
        () -> FrameworkSeedLoader.seedControls(controls, framework("gov"), repository));
  }

  @Test
  void genuineControlCreateFailurePropagates() {
    // If create() fails for a real reason (the row is still absent on re-fetch), the exception
    // must propagate so loadFromResources records a seed failure and the seed gate stays
    // retryable — it must never be swallowed as a benign duplicate.
    AIFrameworkControlRepository repository = mock(AIFrameworkControlRepository.class);
    when(repository.findByNameOrNull(eq("gov.c1"), eq(Include.ALL))).thenReturn(null);
    when(repository.create(isNull(), any(AIFrameworkControl.class)))
        .thenThrow(new UnableToExecuteStatementException("connection reset"));
    JsonNode controls = JsonUtils.readTree("[{\"name\":\"c1\"}]");

    assertThrows(
        UnableToExecuteStatementException.class,
        () -> FrameworkSeedLoader.seedControls(controls, framework("gov"), repository));
  }

  @Test
  void concurrentDuplicateFrameworkIsReused() {
    // Mirror of the control race on the framework path: the pre-check missed, create() trips the
    // fqnHash unique constraint, and the re-fetch returns the framework a concurrent replica wrote.
    // createOrReuse must return that row (so seedBundle still seeds its controls), not throw.
    AIGovernanceFrameworkRepository repository = mock(AIGovernanceFrameworkRepository.class);
    AIGovernanceFramework raced = new AIGovernanceFramework().withName("gov");
    when(repository.create(isNull(), any(AIGovernanceFramework.class)))
        .thenThrow(new UnableToExecuteStatementException("duplicate key value (fqnhash)"));
    when(repository.findByNameOrNull(eq("gov"), eq(Include.ALL))).thenReturn(raced);

    AIGovernanceFramework result =
        FrameworkSeedLoader.createOrReuse(
            repository, new AIGovernanceFramework().withName("gov"), "gov");

    assertSame(raced, result);
  }

  @Test
  void genuineFrameworkCreateFailurePropagates() {
    // If the framework row is still absent on re-fetch, the failure is real and must propagate so
    // loadFromResources records a seed failure and the seed gate stays retryable.
    AIGovernanceFrameworkRepository repository = mock(AIGovernanceFrameworkRepository.class);
    when(repository.create(isNull(), any(AIGovernanceFramework.class)))
        .thenThrow(new UnableToExecuteStatementException("connection reset"));
    when(repository.findByNameOrNull(eq("gov"), eq(Include.ALL))).thenReturn(null);

    assertThrows(
        UnableToExecuteStatementException.class,
        () ->
            FrameworkSeedLoader.createOrReuse(
                repository, new AIGovernanceFramework().withName("gov"), "gov"));
  }

  private EntityReference framework(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.AI_GOVERNANCE_FRAMEWORK)
        .withName(name)
        .withFullyQualifiedName(FullyQualifiedName.build(name));
  }
}
