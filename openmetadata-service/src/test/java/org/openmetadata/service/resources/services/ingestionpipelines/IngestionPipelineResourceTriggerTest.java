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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.security.Authorizer;

class IngestionPipelineResourceTriggerTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void triggerValidatesSuiteTableBeforeCheckingRunner(boolean matching) {
    final UUID id = UUID.randomUUID();
    final String tableFqn = "warehouse.db.schema.orders";
    final EntityReference suiteReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEST_SUITE);
    final TestSuite suite =
        new TestSuite()
            .withBasic(true)
            .withBasicEntityReference(
                new EntityReference().withType(Entity.TABLE).withFullyQualifiedName(tableFqn));
    final IngestionPipeline pipeline =
        new IngestionPipeline()
            .withId(id)
            .withPipelineType(PipelineType.TEST_SUITE)
            .withService(suiteReference)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new TestSuitePipeline()
                            .withEntityFullyQualifiedName(
                                matching ? tableFqn : "warehouse.db.schema.items")));
    final IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    when(repository.get(null, id, null)).thenReturn(pipeline);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
          .thenReturn(repository);
      entity
          .when(() -> Entity.getEntity(suiteReference, "ingestionRunner", Include.NON_DELETED))
          .thenReturn(suite);
      final IngestionPipelineResource resource =
          new IngestionPipelineResource(mock(Authorizer.class), null);

      if (matching) {
        assertEquals(
            "Pipeline Client Disabled", resource.triggerIngestion(null, id, null).getReason());
      } else {
        final BadRequestException exception =
            assertThrows(
                BadRequestException.class, () -> resource.triggerIngestion(null, id, null));
        assertEquals("TestSuite pipeline table must match its test suite", exception.getMessage());
      }
    }
  }
}
