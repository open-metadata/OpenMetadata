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
package org.openmetadata.service.resources;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.glossary.GlossaryTermResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Unit coverage for {@link EntityResource#authorizeBulkAssetsPermission}, the permission gate
 * behind the glossary-term bulk asset endpoints (GHSA-jmw6-578h-gw4r). The static subject lookup
 * and the repository are stubbed; the real allow/deny filtering in the resource runs.
 */
class EntityResourceBulkAssetsAuthorizationTest {
  private static final String ANALYST = "analyst";
  private static final MetadataOperation OPERATION = MetadataOperation.EDIT_GLOSSARY_TERMS;

  private MockedStatic<Entity> entityMock;
  private MockedStatic<DefaultAuthorizer> defaultAuthorizerMock;
  private GlossaryTermRepository repository;
  private Authorizer authorizer;
  private SecurityContext securityContext;
  private GlossaryTermResource glossaryTermResource;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    defaultAuthorizerMock = mockStatic(DefaultAuthorizer.class);
    repository = mock(GlossaryTermRepository.class);
    when(repository.getAllowedFields())
        .thenReturn(Set.of("children", "relatedTerms", "usageCount", "tags"));
    entityMock.when(() -> Entity.getEntityRepository(Entity.GLOSSARY_TERM)).thenReturn(repository);
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.GLOSSARY_TERM))
        .thenReturn(GlossaryTerm.class);
    authorizer = mock(Authorizer.class);
    securityContext = mock(SecurityContext.class);
    glossaryTermResource = new GlossaryTermResource(authorizer, mock(Limits.class));
    clearInvocations(repository);
  }

  @AfterEach
  void tearDown() {
    defaultAuthorizerMock.close();
    entityMock.close();
  }

  @Test
  void deniesCallerWithoutEditGlossaryTermsOnAssetType() {
    callerIs(ANALYST, false, false);
    allowEditGlossaryTermsOn(ANALYST);

    AuthorizationException exception =
        assertThrows(
            AuthorizationException.class,
            () -> authorize(List.of(asset(Entity.TABLE, "svc.db.schema.table1"))));

    assertTrue(exception.getMessage().contains(ANALYST));
    assertTrue(exception.getMessage().contains(Entity.TABLE));
    verifyNoInteractions(repository);
  }

  @Test
  void deniesCallerWhosePermissionIsForAnotherOperation() {
    callerIs(ANALYST, false, false);
    when(authorizer.listPermissions(any(SecurityContext.class), eq(ANALYST)))
        .thenReturn(
            List.of(
                new ResourcePermission()
                    .withResource(Entity.TABLE)
                    .withPermissions(
                        List.of(
                            new Permission()
                                .withOperation(MetadataOperation.VIEW_ALL)
                                .withAccess(Permission.Access.ALLOW)))));

    assertThrows(
        AuthorizationException.class,
        () -> authorize(List.of(asset(Entity.TABLE, "svc.db.schema.table1"))));
  }

  @Test
  void allowsCallerWithEditGlossaryTermsOnAssetType() {
    callerIs(ANALYST, false, false);
    allowEditGlossaryTermsOn(ANALYST, Entity.TABLE);

    assertDoesNotThrow(() -> authorize(List.of(asset(Entity.TABLE, "svc.db.schema.table1"))));
  }

  @Test
  void adminCallerIsExemptWithoutPermissions() {
    callerIs("adminUser", true, false);
    allowEditGlossaryTermsOn("adminUser");

    assertDoesNotThrow(() -> authorize(List.of(asset(Entity.TABLE, "svc.db.schema.table1"))));
  }

  @Test
  void botCallerIsExemptWithoutPermissions() {
    callerIs("ingestionBot", false, true);
    allowEditGlossaryTermsOn("ingestionBot");

    assertDoesNotThrow(() -> authorize(List.of(asset(Entity.TABLE, "svc.db.schema.table1"))));
  }

  @Test
  void emptyAssetListIsAllowedForAnyCaller() {
    callerIs(ANALYST, false, false);
    allowEditGlossaryTermsOn(ANALYST);

    assertDoesNotThrow(() -> authorize(List.of()));
  }

  @Test
  void mixedAssetTypesAreDeniedWhenOneTypeLacksPermission() {
    callerIs(ANALYST, false, false);
    allowEditGlossaryTermsOn(ANALYST, Entity.TABLE);

    AuthorizationException exception =
        assertThrows(
            AuthorizationException.class,
            () ->
                authorize(
                    List.of(
                        asset(Entity.TABLE, "svc.db.schema.table1"),
                        asset(Entity.TOPIC, "broker.topic1"))));

    assertTrue(exception.getMessage().contains(Entity.TOPIC));
    assertFalse(exception.getMessage().contains(Entity.TABLE));
    verifyNoInteractions(repository);
  }

  private void authorize(List<EntityReference> assets) {
    glossaryTermResource.authorizeBulkAssetsPermission(securityContext, assets, OPERATION);
  }

  private void callerIs(String userName, boolean isAdmin, boolean isBot) {
    SubjectContext subjectContext =
        new SubjectContext(
            new User().withName(userName).withIsAdmin(isAdmin).withIsBot(isBot), null);
    defaultAuthorizerMock
        .when(() -> DefaultAuthorizer.getSubjectContext(any(SecurityContext.class)))
        .thenReturn(subjectContext);
  }

  private void allowEditGlossaryTermsOn(String userName, String... resources) {
    when(authorizer.listPermissions(any(SecurityContext.class), eq(userName)))
        .thenReturn(Arrays.stream(resources).map(this::editGlossaryTermsAllowed).toList());
  }

  private ResourcePermission editGlossaryTermsAllowed(String resource) {
    Permission permission =
        new Permission().withOperation(OPERATION).withAccess(Permission.Access.ALLOW);
    return new ResourcePermission().withResource(resource).withPermissions(List.of(permission));
  }

  private static EntityReference asset(String type, String fullyQualifiedName) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withFullyQualifiedName(fullyQualifiedName);
  }
}
