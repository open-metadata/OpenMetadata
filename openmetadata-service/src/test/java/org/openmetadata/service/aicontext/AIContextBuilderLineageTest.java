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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.aicontext.LineageEdgeContext;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * The lineage section of an AI context names the asset's neighbours and their mapped columns, so it
 * is built from the graph the caller gets from the lineage API. The repositories and the authorizer
 * are stubbed; the builder and {@code LineagePermissionFilter} run for real.
 */
class AIContextBuilderLineageTest {
  private static final EntityReference UPSTREAM = table("svc.db.schema.upstream_table");
  private static final EntityReference ROOT = table("svc.db.schema.root_table");

  private MockedStatic<Entity> entityMock;
  private MockedStatic<DefaultAuthorizer> defaultAuthorizerMock;
  private Authorizer authorizer;
  private SecurityContext securityContext;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    defaultAuthorizerMock = mockStatic(DefaultAuthorizer.class);
    // LineageRepository reads Entity.getSearchRepository() when the class initializes.
    entityMock.when(Entity::getSearchRepository).thenReturn(mock(SearchRepository.class));
    TableRepository tableRepository = tableRepository();
    entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);
    authorizer = mock(Authorizer.class);
    securityContext = mock(SecurityContext.class);
    SubjectContext subjectContext = mock(SubjectContext.class);
    defaultAuthorizerMock
        .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
        .thenReturn(subjectContext);
    LineageRepository lineageRepository = mock(LineageRepository.class);
    String rootId = ROOT.getId().toString();
    when(lineageRepository.get(Entity.TABLE, rootId, 1, 1)).thenAnswer(i -> graph());
    when(lineageRepository.get(Entity.TABLE, rootId, 1, 1, subjectContext))
        .thenAnswer(i -> graph());
    entityMock.when(Entity::getLineageRepository).thenReturn(lineageRepository);
  }

  @AfterEach
  void tearDown() {
    defaultAuthorizerMock.close();
    entityMock.close();
  }

  @Test
  void viewableNeighbourIsNamedWithItsColumnMappings() {
    List<LineageEdgeContext> upstream = AIContextBuilder.edgeContexts(lineageForCaller(), true);

    assertEquals(1, upstream.size());
    assertEquals(UPSTREAM.getFullyQualifiedName(), upstream.getFirst().getFullyQualifiedName());
    assertEquals(1, upstream.getFirst().getColumns().size());
  }

  @Test
  void deniedNeighbourIsLeftOutWithItsColumnMappings() {
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    EntityLineage lineage = lineageForCaller();

    assertTrue(lineage.getNodes().isEmpty());
    assertTrue(AIContextBuilder.edgeContexts(lineage, true).isEmpty());
  }

  @Test
  void sectionIsEmptyWhenTheCallerCannotBeResolved() {
    defaultAuthorizerMock
        .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
        .thenThrow(new AuthorizationException("no principal"));

    assertNull(lineageForCaller());
  }

  @Test
  void serverInternalBuildReadsTheWholeGraph() {
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    EntityLineage lineage = builder().fetchLineage(rootTable());

    assertEquals(List.of(UPSTREAM), lineage.getNodes());
  }

  private EntityLineage lineageForCaller() {
    return builder().withSecurity(authorizer, securityContext).fetchLineage(rootTable());
  }

  private static AIContextBuilder builder() {
    return new AIContextBuilder(Entity.TABLE, ROOT.getFullyQualifiedName());
  }

  private static Table rootTable() {
    return new Table().withId(ROOT.getId()).withFullyQualifiedName(ROOT.getFullyQualifiedName());
  }

  private static TableRepository tableRepository() {
    TableRepository tableRepository = mock(TableRepository.class);
    when(tableRepository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    when(tableRepository.get(isNull(), anyList(), any(Fields.class), any(Include.class)))
        .thenAnswer(
            invocation -> {
              List<UUID> ids = invocation.getArgument(1);
              return ids.stream().map(AIContextBuilderLineageTest::loadedTable).toList();
            });
    return tableRepository;
  }

  private static EntityLineage graph() {
    ColumnLineage mapping =
        new ColumnLineage()
            .withFromColumns(List.of(UPSTREAM.getFullyQualifiedName() + ".source_column"))
            .withToColumn(ROOT.getFullyQualifiedName() + ".target_column");
    Edge edge =
        new Edge()
            .withFromEntity(UPSTREAM.getId())
            .withToEntity(ROOT.getId())
            .withLineageDetails(new LineageDetails().withColumnsLineage(List.of(mapping)));
    return new EntityLineage()
        .withEntity(ROOT)
        .withNodes(new ArrayList<>(List.of(UPSTREAM)))
        .withUpstreamEdges(new ArrayList<>(List.of(edge)))
        .withDownstreamEdges(new ArrayList<>());
  }

  // Entity's type map is mocked away here, so the reference is given rather than derived from it.
  private static Table loadedTable(UUID id) {
    Table table = mock(Table.class);
    when(table.getId()).thenReturn(id);
    when(table.getEntityReference())
        .thenReturn(new EntityReference().withId(id).withType(Entity.TABLE));
    return table;
  }

  private static EntityReference table(String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.TABLE)
        .withName(fqn.substring(fqn.lastIndexOf('.') + 1))
        .withFullyQualifiedName(fqn);
  }
}
