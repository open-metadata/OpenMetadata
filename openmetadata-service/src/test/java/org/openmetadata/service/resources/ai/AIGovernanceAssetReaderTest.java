package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIApplicationRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;

class AIGovernanceAssetReaderTest {
  @Test
  void deniedPagesDoNotConsumeThePermittedAssetLimit() {
    final AIApplication denied = application("denied");
    final AIApplication allowed = application("allowed");
    final Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              final ResourceContextInterface resource = invocation.getArgument(2);
              if (denied.getId().equals(resource.getEntity().getId())) {
                throw new AuthorizationException("Denied by asset policy");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    final AIApplicationRepository repository = repository();
    final ResultList<AIApplication> deniedPage = new ResultList<>(List.of(denied), null, "next", 2);
    when(repository.listAfter(any(), any(), any(), anyInt(), eq(null))).thenReturn(deniedPage);
    when(repository.listAfter(any(), any(), any(), anyInt(), eq(deniedPage.getPaging().getAfter())))
        .thenReturn(new ResultList<>(List.of(allowed), null, null, 2));
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(repository);
      assertEquals(List.of(allowed), reader(authorizer).list(Entity.AI_APPLICATION, "", 1));
    }
  }

  @Test
  void visitorProcessesEachPageBeforeLoadingTheNext() {
    final AIApplication first = application("first");
    final AIApplication second = application("second");
    final List<UUID> visited = new ArrayList<>();
    final AIApplicationRepository repository = repository();
    final ResultList<AIApplication> firstPage = new ResultList<>(List.of(first), null, "next", 2);
    when(repository.listAfter(any(), any(), any(), anyInt(), eq(null))).thenReturn(firstPage);
    when(repository.listAfter(any(), any(), any(), anyInt(), eq(firstPage.getPaging().getAfter())))
        .thenAnswer(
            invocation -> {
              assertEquals(List.of(first.getId()), visited);
              return new ResultList<>(List.of(second), null, null, 2);
            });
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(repository);
      reader(mock(Authorizer.class))
          .forEach(Entity.AI_APPLICATION, "", entity -> visited.add(entity.getId()));
      assertEquals(List.of(first.getId(), second.getId()), visited);
    }
  }

  @Test
  void pagesCarryPolicyAttributesAndRequestedFieldsBeforeAuthorization() {
    final AIApplication application = application("allowed");
    final AIApplicationRepository repository = repository();
    final AtomicReference<Fields> projection = new AtomicReference<>();
    when(repository.listAfter(any(), any(), any(), anyInt(), any()))
        .thenAnswer(
            invocation -> {
              projection.set(invocation.getArgument(1));
              return new ResultList<>(List.of(application), null, null, 1);
            });
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(repository);
      assertEquals(
          List.of(application),
          reader(mock(Authorizer.class)).list(Entity.AI_APPLICATION, "governanceMetadata"));
      assertTrue(
          projection
              .get()
              .getFieldList()
              .containsAll(Set.of("owners", "domains", "governanceMetadata")));
    }
  }

  @Test
  void failedAuthorizationNeverReleasesAnAsset() {
    final AIApplicationRepository repository = repository();
    when(repository.listAfter(any(), any(), any(), anyInt(), any()))
        .thenReturn(new ResultList<>(List.of(application("hidden")), null, null, 1));
    final Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              throw new IllegalStateException("Policy unavailable");
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(repository);
      assertTrue(reader(authorizer).list(Entity.AI_APPLICATION, "").isEmpty());
    }
  }

  @Test
  void reportsWithoutARecordedRequesterFailClosed() {
    assertThrows(
        AuthorizationException.class,
        () -> AIGovernanceAssetReader.forReport(mock(Authorizer.class), new AuditReport()));
    assertThrows(
        AuthorizationException.class,
        () ->
            AIGovernanceAssetReader.forReport(
                mock(Authorizer.class), new AuditReport().withRequestedBy(new EntityReference())));
  }

  @Test
  void reportWorkersResolveTheRequesterByIdAndUseTheirCurrentPermissions() {
    final UUID userId = UUID.randomUUID();
    final User user = new User().withId(userId).withName("renamed_requester");
    final AIApplication application = application("permitted");
    final AIApplicationRepository repository = repository();
    when(repository.listAfter(any(), any(), any(), anyInt(), any()))
        .thenReturn(new ResultList<>(List.of(application), null, null, 1));
    final Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              final CatalogSecurityContext context = invocation.getArgument(0);
              assertEquals(user.getName(), context.getUserPrincipal().getName());
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntity(Entity.USER, userId, "", Include.NON_DELETED))
          .thenReturn(user);
      entities.when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION)).thenReturn(repository);
      final AuditReport report =
          new AuditReport()
              .withUpdatedBy("admin")
              .withRequestedBy(new EntityReference().withId(userId).withName("old_requester"));
      final AIGovernanceAssetReader reader = AIGovernanceAssetReader.forReport(authorizer, report);
      assertEquals(List.of(application), reader.list(Entity.AI_APPLICATION, ""));
      doAnswer(
              invocation -> {
                throw new AuthorizationException("Access revoked");
              })
          .when(authorizer)
          .authorize(any(), any(), any());
      assertTrue(reader.list(Entity.AI_APPLICATION, "").isEmpty());
    }
  }

  private static AIApplicationRepository repository() {
    final AIApplicationRepository repository = mock(AIApplicationRepository.class);
    when(repository.isSupportsOwners()).thenReturn(true);
    when(repository.isSupportsDomains()).thenReturn(true);
    when(repository.getFields(anyString()))
        .thenAnswer(
            invocation ->
                new Fields(
                    Arrays.stream(invocation.<String>getArgument(0).split(","))
                        .map(String::trim)
                        .filter(field -> !field.isEmpty())
                        .collect(Collectors.toSet())));
    return repository;
  }

  private static AIApplication application(final String name) {
    return new AIApplication().withId(UUID.randomUUID()).withName(name);
  }

  private static AIGovernanceAssetReader reader(final Authorizer authorizer) {
    return new AIGovernanceAssetReader(
        authorizer,
        new CatalogSecurityContext(
            () -> "reader", "https", CatalogSecurityContext.OPENID_AUTH, Set.of()));
  }
}
