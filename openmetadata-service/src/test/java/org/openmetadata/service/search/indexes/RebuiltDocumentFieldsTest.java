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

package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.DocBuildContext.ServiceStylePrefetch;

/** A rebuilt document must carry every field the live writes put there, or a reindex drops it. */
class RebuiltDocumentFieldsTest {
  private static final EntityReference SERVICE =
      new EntityReference().withId(UUID.randomUUID()).withType("databaseService").withName("svc");
  private static MockedStatic<Entity> entities;

  @BeforeAll
  static void mockCatalog() {
    entities = Mockito.mockStatic(Entity.class);
    entities
        .when(Entity::getSearchRepository)
        .thenReturn(Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS));
    entities.when(() -> Entity.getEntityTags(anyString(), any())).thenReturn(List.of());
    final CollectionDAO dao = mock(CollectionDAO.class);
    final CollectionDAO.EntityRelationshipDAO relationships =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relationships);
    when(relationships.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entities.when(Entity::getCollectionDAO).thenReturn(dao);
  }

  @AfterAll
  static void closeCatalog() {
    entities.close();
  }

  static Stream<SearchIndex> lineageTargets() {
    return Stream.of(
        new APICollectionIndex(named(new APICollection(), "collection")),
        new FolderIndex(named(new Folder(), "folder")),
        new ContextFileIndex(named(new ContextFile(), "file")),
        new AuditReportIndex(named(new AuditReport(), "report")),
        new AiFrameworkControlIndex(named(new AIFrameworkControl(), "control")),
        new AiGovernanceFrameworkIndex(named(new AIGovernanceFramework(), "framework")));
  }

  @ParameterizedTest
  @MethodSource("lineageTargets")
  void rebuiltDocumentsKeepTheirUpstreamLineage(final SearchIndex index) {
    final List<EsLineageData> lineage = List.of(new EsLineageData().withDocId("upstream->this"));

    final Map<String, Object> document =
        index.buildSearchIndexDoc(DocBuildContext.withUpstreamLineage(lineage));

    assertEquals(lineage, document.get("upstreamLineage"));
  }

  static Stream<SearchIndex> serviceChildren() {
    return Stream.of(
        new DatabaseIndex(named(new Database(), "db").withService(SERVICE)),
        new DatabaseSchemaIndex(named(new DatabaseSchema(), "schema").withService(SERVICE)),
        new APICollectionIndex(named(new APICollection(), "collection").withService(SERVICE)),
        new ChartIndex(named(new Chart(), "chart").withService(SERVICE)),
        new McpServerIndex(named(new McpServer(), "server").withService(SERVICE)));
  }

  @ParameterizedTest
  @MethodSource("serviceChildren")
  void rebuiltChildDocumentsKeepTheirServiceStyle(final SearchIndex index) {
    final Style style = new Style().withColor("#336699").withIconURL("https://icons/svc.png");

    final Map<String, Object> document =
        index.buildSearchIndexDoc(
            DocBuildContext.of(null, ServiceStylePrefetch.prefetched(Optional.of(style))));

    assertEquals(style, ((Map<?, ?>) document.get("service")).get("style"));
  }

  private static <T extends EntityInterface<?>> T named(final T entity, final String name) {
    entity.setId(UUID.randomUUID());
    entity.setName(name);
    entity.setFullyQualifiedName("svc." + name);
    return entity;
  }
}
