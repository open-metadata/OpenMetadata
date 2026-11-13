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

package org.openmetadata.service.resources.tasks;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.json.Json;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;

class TaskResourceTest {

  @Test
  void patchIsAuthorizedBeforeItIsSimulated() {
    UUID taskId = UUID.randomUUID();
    SecurityContext securityContext = mock(SecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn("alice");
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    Authorizer authorizer = mock(Authorizer.class);
    TaskRepository repository = mock(TaskRepository.class);
    AuthorizationException denied = new AuthorizationException("denied");
    when(repository.getAllowedFields()).thenReturn(Set.of("id", "about"));
    when(repository.get(any(), eq(taskId), any()))
        .thenReturn(new Task().withId(taskId).withDescription("stored description"));
    doThrow(denied)
        .when(authorizer)
        .authorizeRequests(eq(securityContext), any(), eq(AuthorizationLogic.ALL));
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(repository);
      entity.when(() -> Entity.getEntityClassFromType(Entity.TASK)).thenReturn(Task.class);
      TaskResource resource = new TaskResource(authorizer, mock(Limits.class));

      // Cannot be applied to any task: simulated first, its JSON-P error would print the task.
      AuthorizationException thrown =
          assertThrows(
              AuthorizationException.class,
              () ->
                  resource.patch(
                      null,
                      securityContext,
                      taskId,
                      Json.createPatchBuilder().copy("/description", "/x/y").build()));

      assertEquals(denied, thrown);
    }
  }
}
