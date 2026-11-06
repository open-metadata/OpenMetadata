/*
 *  Copyright 2026 Collate.
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class AIAssetVisibilityTest {

  static {
    // Entity.registerEntity populates this at server startup; unit tests have no registry.
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("aiapplication", Entity.AI_APPLICATION);
  }

  @Test
  void unrestrictedAdmitsEveryAsset() {
    List<EntityInterface<?>> assets =
        List.of(application(UUID.randomUUID()), application(UUID.randomUUID()));
    assertEquals(assets, AIAssetVisibility.unrestricted().filter(assets));
  }

  @Test
  void forCallerWithNullContextAdmitsEveryAsset() {
    List<EntityInterface<?>> assets = List.of(application(UUID.randomUUID()));
    assertEquals(assets, AIAssetVisibility.forCaller(null, mock(Authorizer.class)).filter(assets));
  }

  @Test
  void forCallerAdmitsEveryAssetForAdmin() {
    try (MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      SubjectContext subjectContext = mock(SubjectContext.class);
      when(subjectContext.isAdmin()).thenReturn(true);
      authMock
          .when(() -> DefaultAuthorizer.getSubjectContext(any(SecurityContext.class)))
          .thenReturn(subjectContext);

      List<EntityInterface<?>> assets = List.of(application(UUID.randomUUID()));
      assertEquals(
          assets,
          AIAssetVisibility.forCaller(securityContext("admin"), mock(Authorizer.class))
              .filter(assets));
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void forCallerHidesAssetsTheAuthorizerDenies() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      UUID visibleId = UUID.randomUUID();
      UUID hiddenId = UUID.randomUUID();
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      Authorizer authorizer = mock(Authorizer.class);
      SecurityContext securityContext = securityContext("mallory");

      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.get(any(), any(), any(), any()))
          .thenReturn(List.of(application(visibleId), application(hiddenId)));
      SubjectContext subjectContext = nonAdminSubject();
      authMock
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(subjectContext);
      doThrow(new AuthorizationException("operation ViewBasic denied by DomainAccessDenyRule"))
          .when(authorizer)
          .authorize(
              eq(securityContext),
              any(OperationContext.class),
              argThat(context -> hasEntityId(context, hiddenId)));

      AIAssetVisibility visibility = AIAssetVisibility.forCaller(securityContext, authorizer);
      List<EntityInterface<?>> filtered =
          visibility.filter(List.of(application(visibleId), application(hiddenId)));

      assertEquals(1, filtered.size());
      assertEquals(visibleId, filtered.get(0).getId());
    }
  }

  @Test
  void forUserHidesEverythingWithoutUserName() {
    List<EntityInterface<?>> assets = List.of(application(UUID.randomUUID()));
    assertTrue(AIAssetVisibility.forUser(null).filter(assets).isEmpty());
    assertTrue(AIAssetVisibility.forUser("  ").filter(assets).isEmpty());
  }

  @Test
  @SuppressWarnings("unchecked")
  void forUserFailsClosedWhenTheUserCheckThrows() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      authMock
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenThrow(new AuthorizationException("operation ViewBasic denied"));
      assertTrue(
          AIAssetVisibility.forUser("mallory")
              .filter(List.of(application(UUID.randomUUID())))
              .isEmpty());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void forUserAdmitsAssetsTheUserCanView() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> ignored = mockStatic(DefaultAuthorizer.class)) {
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      UUID id = UUID.randomUUID();
      assertEquals(1, AIAssetVisibility.forUser("mallory").filter(List.of(application(id))).size());
    }
  }

  private static AIApplication application(UUID id) {
    return new AIApplication().withId(id).withName("app_" + id).withFullyQualifiedName("app_" + id);
  }

  private static SubjectContext nonAdminSubject() {
    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(false);
    return subjectContext;
  }

  private static boolean hasEntityId(ResourceContextInterface context, UUID id) {
    boolean matches = false;
    try {
      EntityInterface<?> entity = context.getEntity();
      matches = entity != null && id.equals(entity.getId());
    } catch (RuntimeException e) {
      matches = false;
    }
    return matches;
  }

  private SecurityContext securityContext(String user) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(user);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
