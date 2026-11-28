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
package org.openmetadata.service.resources.lineage;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class LineageResourceDeleteByTypeAuthorizationTest {

  private static final String TABLE_TYPE = Entity.TABLE;
  private static final String PIPELINE_TYPE = Entity.PIPELINE;
  private static final String CALLER = "analyst";

  private MockedStatic<Entity> entityMock;
  private Authorizer authorizer;
  private SecurityContext securityContext;
  private LineageRepository lineageRepository;
  private EntityRepository<?> tableRepository;
  private EntityRepository<?> pipelineRepository;
  private LineageResource lineageResource;
  private UUID tableId;
  private EntityReference tableRef;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    authorizer = mock(Authorizer.class);
    securityContext = mock(SecurityContext.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(CALLER);
    when(securityContext.getUserPrincipal()).thenReturn(principal);

    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getSearchClient()).thenReturn(mock(SearchClient.class));
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
    lineageRepository = mock(LineageRepository.class);
    entityMock.when(Entity::getLineageRepository).thenReturn(lineageRepository);

    tableRepository = mock(EntityRepository.class);
    pipelineRepository = mock(EntityRepository.class);
    when(tableRepository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    when(pipelineRepository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    entityMock.when(() -> Entity.getEntityRepository(TABLE_TYPE)).thenReturn(tableRepository);
    entityMock.when(() -> Entity.getEntityRepository(PIPELINE_TYPE)).thenReturn(pipelineRepository);

    tableId = UUID.randomUUID();
    tableRef =
        new EntityReference()
            .withId(tableId)
            .withType(TABLE_TYPE)
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders");
    entityMock
        .when(() -> Entity.getEntityReferenceById(TABLE_TYPE, tableId, Include.ALL))
        .thenReturn(tableRef);

    lineageResource = new LineageResource(authorizer);
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
  }

  @Test
  void deleteLineageByType_authorizesAgainstTargetEntityResourceContext() {
    doNothing().when(authorizer).authorize(any(), any(), any());

    Response response =
        lineageResource.deleteLineageByType(
            null, securityContext, TABLE_TYPE, tableId, LineageDetails.Source.VIEW_LINEAGE.value());

    assertEquals(OK.getStatusCode(), response.getStatus());

    ArgumentCaptor<OperationContext> operationCaptor =
        ArgumentCaptor.forClass(OperationContext.class);
    ArgumentCaptor<ResourceContextInterface> resourceCaptor =
        ArgumentCaptor.forClass(ResourceContextInterface.class);
    verify(authorizer).authorize(any(), operationCaptor.capture(), resourceCaptor.capture());

    OperationContext capturedOp = operationCaptor.getValue();
    assertEquals(TABLE_TYPE, capturedOp.getResource());
    List<MetadataOperation> operations = capturedOp.getOperations(null);
    assertTrue(operations.contains(MetadataOperation.EDIT_LINEAGE));

    ResourceContext<?> capturedResource =
        assertInstanceOf(ResourceContext.class, resourceCaptor.getValue());
    assertEquals(TABLE_TYPE, capturedResource.getResource());
    capturedResource.getEntity();
    verify(tableRepository)
        .get(isNull(), eq(tableId), any(Fields.class), any(RelationIncludes.class), eq(true));

    entityMock.verify(() -> Entity.getEntityReferenceById(TABLE_TYPE, tableId, Include.ALL));
    verify(lineageRepository)
        .deleteLineageBySource(
            tableId, TABLE_TYPE, LineageDetails.Source.VIEW_LINEAGE.value(), CALLER);
  }

  @Test
  void deleteLineageByType_authorizesAgainstPipelineEntityType() {
    UUID pipelineId = UUID.randomUUID();
    EntityReference pipelineRef =
        new EntityReference()
            .withId(pipelineId)
            .withType(PIPELINE_TYPE)
            .withName("etl_orders")
            .withFullyQualifiedName("airflow.etl_orders");
    entityMock
        .when(() -> Entity.getEntityReferenceById(PIPELINE_TYPE, pipelineId, Include.ALL))
        .thenReturn(pipelineRef);
    doNothing().when(authorizer).authorize(any(), any(), any());

    Response response =
        lineageResource.deleteLineageByType(
            null,
            securityContext,
            PIPELINE_TYPE,
            pipelineId,
            LineageDetails.Source.PIPELINE_LINEAGE.value());

    assertEquals(OK.getStatusCode(), response.getStatus());
    ArgumentCaptor<OperationContext> operationCaptor =
        ArgumentCaptor.forClass(OperationContext.class);
    ArgumentCaptor<ResourceContextInterface> resourceCaptor =
        ArgumentCaptor.forClass(ResourceContextInterface.class);
    verify(authorizer).authorize(any(), operationCaptor.capture(), resourceCaptor.capture());
    assertEquals(PIPELINE_TYPE, operationCaptor.getValue().getResource());
    assertTrue(
        operationCaptor.getValue().getOperations(null).contains(MetadataOperation.EDIT_LINEAGE));
    ResourceContext<?> capturedResource =
        assertInstanceOf(ResourceContext.class, resourceCaptor.getValue());
    assertEquals(PIPELINE_TYPE, capturedResource.getResource());
    capturedResource.getEntity();
    verify(pipelineRepository)
        .get(isNull(), eq(pipelineId), any(Fields.class), any(RelationIncludes.class), eq(true));
    verify(lineageRepository)
        .deleteLineageBySource(
            pipelineId, PIPELINE_TYPE, LineageDetails.Source.PIPELINE_LINEAGE.value(), CALLER);
  }

  @Test
  void deleteLineageByType_deniedThrowsAndDoesNotCallRepository() {
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () ->
            lineageResource.deleteLineageByType(
                null,
                securityContext,
                TABLE_TYPE,
                tableId,
                LineageDetails.Source.VIEW_LINEAGE.value()));

    verify(lineageRepository, never()).deleteLineageBySource(any(), any(), any(), any());
  }

  @Test
  void deleteLineageByType_missingEntityThrows404AndSkipsAuthorizationAndDelete() {
    UUID missingId = UUID.randomUUID();
    entityMock
        .when(() -> Entity.getEntityReferenceById(TABLE_TYPE, missingId, Include.ALL))
        .thenThrow(new EntityNotFoundException("Entity not found"));

    assertThrows(
        EntityNotFoundException.class,
        () ->
            lineageResource.deleteLineageByType(
                null,
                securityContext,
                TABLE_TYPE,
                missingId,
                LineageDetails.Source.VIEW_LINEAGE.value()));

    verify(authorizer, never()).authorize(any(), any(), any());
    verify(lineageRepository, never()).deleteLineageBySource(any(), any(), any(), any());
  }
}
