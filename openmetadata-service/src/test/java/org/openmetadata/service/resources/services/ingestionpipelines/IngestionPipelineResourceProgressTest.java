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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;

class IngestionPipelineResourceProgressTest {

  @Test
  void serviceProgressRejectsNonServiceEntityTypes() {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(Entity::getServiceEntityTypes).thenReturn(List.of(Entity.DATABASE_SERVICE));
      entities
          .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
          .thenReturn(mock(IngestionPipelineRepository.class));
      IngestionPipelineResource resource =
          new IngestionPipelineResource(mock(Authorizer.class), mock(Limits.class));

      assertThrows(
          BadRequestException.class,
          () -> resource.streamServiceProgress(null, null, null, Entity.TABLE, "svc"));
    }
  }

  private static Method findStreamServiceProgressMethod() {
    return Arrays.stream(IngestionPipelineResource.class.getMethods())
        .filter(m -> "streamServiceProgress".equals(m.getName()))
        .findFirst()
        .orElse(null);
  }

  @Test
  void streamServiceProgressHasExpectedPath() {
    Method method = findStreamServiceProgressMethod();
    assertNotNull(method, "streamServiceProgress method should be registered on the resource");

    Path pathAnnotation = method.getAnnotation(Path.class);
    assertNotNull(pathAnnotation, "streamServiceProgress must declare a @Path");
    assertEquals("/progress/service/{serviceType}/{serviceFqn}/stream", pathAnnotation.value());
  }

  @Test
  void streamServiceProgressProducesServerSentEvents() {
    Method method = findStreamServiceProgressMethod();
    assertNotNull(method, "streamServiceProgress method should be registered on the resource");

    Produces producesAnnotation = method.getAnnotation(Produces.class);
    assertNotNull(producesAnnotation, "streamServiceProgress must declare @Produces");
    assertTrue(
        Arrays.asList(producesAnnotation.value()).contains(MediaType.SERVER_SENT_EVENTS),
        "streamServiceProgress must produce text/event-stream");
  }

  @Test
  void streamServiceProgressIsAGetEndpoint() {
    Method method = findStreamServiceProgressMethod();
    assertNotNull(method, "streamServiceProgress method should be registered on the resource");
    assertNotNull(method.getAnnotation(GET.class), "streamServiceProgress must be a @GET method");
  }
}
