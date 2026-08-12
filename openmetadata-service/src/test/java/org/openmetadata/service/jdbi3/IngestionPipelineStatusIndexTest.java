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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Regression test for #31334. addPipelineStatus hands its pipeline to
 * searchRepository.updateEntityIndex, which may rebuild the whole search document from it. Any field
 * the method did not load would be written to the index as empty.
 */
class IngestionPipelineStatusIndexTest {

  private static final String SERVICE_FQN = "mysqlService";
  private static final String PIPELINE_NAME = "metadataPipeline";
  private static final String PIPELINE_FQN = SERVICE_FQN + "." + PIPELINE_NAME;
  private static final EntityReference OWNER =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("data-eng");
  private static final EntityReference DOMAIN =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN).withName("analytics");
  private static final EntityReference FOLLOWER =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("watcher");

  @Test
  void addPipelineStatusKeepsOwnersAndDomainsOnTheIndexedPipeline() {
    SearchRepository searchRepository = mock(SearchRepository.class);

    // Only the two lookups the repository constructor needs are stubbed; the rest of Entity stays
    // real so the repository is built with its actual allowed fields.
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock
          .when(Entity::getCollectionDAO)
          .thenReturn(mock(CollectionDAO.class, RETURNS_DEEP_STUBS));
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      IngestionPipelineRepository repository =
          spy(new IngestionPipelineRepository(new OpenMetadataApplicationConfig()));
      // A read only populates the fields it was asked for, so answer the same way: owners and
      // domains come back only if addPipelineStatus actually requested them.
      doAnswer(invocation -> pipelineFor(invocation.getArgument(2, Fields.class)))
          .when(repository)
          .getByName(any(), anyString(), any(Fields.class));
      doReturn(List.of()).when(repository).getRecentPipelineStatuses(anyString());

      repository.addPipelineStatus(null, PIPELINE_FQN, new PipelineStatus().withRunId("run-1"));

      ArgumentCaptor<IngestionPipeline> indexed = ArgumentCaptor.forClass(IngestionPipeline.class);
      verify(searchRepository).updateEntityIndex(indexed.capture());
      assertEquals(List.of(OWNER), indexed.getValue().getOwners());
      assertEquals(List.of(DOMAIN), indexed.getValue().getDomains());
      assertEquals(List.of(FOLLOWER), indexed.getValue().getFollowers());
    }
  }

  private static IngestionPipeline pipelineFor(Fields fields) {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withId(UUID.randomUUID())
            .withName(PIPELINE_NAME)
            .withFullyQualifiedName(PIPELINE_FQN)
            .withVersion(0.1)
            .withService(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(Entity.DATABASE_SERVICE)
                    .withName(SERVICE_FQN)
                    .withFullyQualifiedName(SERVICE_FQN));
    if (fields.contains(Entity.FIELD_OWNERS)) {
      pipeline.withOwners(List.of(OWNER));
    }
    if (fields.contains(Entity.FIELD_DOMAINS)) {
      pipeline.withDomains(List.of(DOMAIN));
    }
    if (fields.contains(Entity.FIELD_FOLLOWERS)) {
      pipeline.withFollowers(List.of(FOLLOWER));
    }
    return pipeline;
  }
}
