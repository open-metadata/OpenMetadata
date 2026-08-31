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
package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexFailureDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexFailureDAO.RdfIndexFailureRecord;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

@DisplayName("RdfReindexResource")
class RdfReindexResourceTest {

  private static final SecurityContext SECURITY_CONTEXT = mock(SecurityContext.class);

  private record Fixture(
      RdfReindexResource resource, RdfIndexFailureDAO failureDAO, Authorizer authorizer) {}

  private static RdfIndexFailureRecord failure(String id, String entityType) {
    return new RdfIndexFailureRecord(
        id, "job-1", "server-1", entityType, "entity-id", "fqn", "ENTITY_WRITE", "boom", null, 1L);
  }

  /** Builds the resource with the static Entity DAO lookup its constructor performs. */
  private Fixture fixture() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    RdfIndexFailureDAO failureDAO = mock(RdfIndexFailureDAO.class);
    when(collectionDAO.rdfIndexFailureDAO()).thenReturn(failureDAO);
    Authorizer authorizer = mock(Authorizer.class);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      return new Fixture(new RdfReindexResource(authorizer), failureDAO, authorizer);
    }
  }

  @Test
  @DisplayName("unfiltered read pages the whole table and reports the total")
  void unfilteredReadPagesWholeTable() {
    Fixture fixture = fixture();
    when(fixture.failureDAO().countAll()).thenReturn(2);
    when(fixture.failureDAO().findAll(50, 0))
        .thenReturn(List.of(failure("a", "table"), failure("b", "topic")));

    RdfReindexResource.RdfReindexFailuresResponse response =
        fixture.resource().getFailures(SECURITY_CONTEXT, 0, 50, null);

    assertEquals(2, response.total());
    assertEquals(2, response.data().size());
    assertEquals(0, response.offset());
    assertEquals(50, response.limit());
    verify(fixture.failureDAO(), never()).countByEntityType(any());
  }

  @Test
  @DisplayName("entityType filter uses the filtered count, not the table total")
  void entityTypeFilterUsesFilteredCount() {
    Fixture fixture = fixture();
    when(fixture.failureDAO().countByEntityType("table")).thenReturn(1);
    when(fixture.failureDAO().findByEntityType("table", 20, 40))
        .thenReturn(List.of(failure("a", "table")));

    RdfReindexResource.RdfReindexFailuresResponse response =
        fixture.resource().getFailures(SECURITY_CONTEXT, 40, 20, "table");

    assertEquals(1, response.total());
    assertEquals("table", response.data().getFirst().getEntityType());
    assertEquals(40, response.offset());
    assertEquals(20, response.limit());
    // The unfiltered count would report every entity type's failures against a filtered page.
    verify(fixture.failureDAO(), never()).countAll();
  }

  @Test
  @DisplayName("an empty entityType is treated as no filter")
  void emptyEntityTypeIsNoFilter() {
    Fixture fixture = fixture();
    when(fixture.failureDAO().countAll()).thenReturn(0);
    when(fixture.failureDAO().findAll(50, 0)).thenReturn(List.of());

    RdfReindexResource.RdfReindexFailuresResponse response =
        fixture.resource().getFailures(SECURITY_CONTEXT, 0, 50, "");

    assertEquals(0, response.total());
    verify(fixture.failureDAO()).countAll();
    verify(fixture.failureDAO(), never()).countByEntityType(any());
  }

  @Test
  @DisplayName("a non-admin is rejected before any failure row is read")
  void nonAdminIsRejectedBeforeReading() {
    Fixture fixture = fixture();
    doThrow(new AuthorizationException(CatalogExceptionMessage.notAdmin("someone")))
        .when(fixture.authorizer())
        .authorizeAdmin(SECURITY_CONTEXT);

    assertThrows(
        AuthorizationException.class,
        () -> fixture.resource().getFailures(SECURITY_CONTEXT, 0, 50, null));

    verify(fixture.failureDAO(), never()).countAll();
    verify(fixture.failureDAO(), never()).findAll(50, 0);
  }
}
