package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchUtils;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class LineageIndexWriteOrderIT {

  @Test
  void deletionIsIndexedBeforeItsResponseAndAReplacementIsRetained(TestNamespace ns)
      throws Exception {
    var schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table from = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "from");
    Table to = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "to");
    var client = SdkClients.adminClient();
    var edge =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference()));

    client.lineage().addLineage(edge);
    assertEquals(1, indexedEdges(to).size());

    client.lineage().deleteLineage("table:" + from.getId(), "table:" + to.getId());
    assertTrue(
        indexedEdges(to).isEmpty(),
        "A successful delete must not leave a background task that can erase a subsequent add");

    client.lineage().addLineage(edge);
    assertEquals(1, indexedEdges(to).size());
    assertEquals(from.getId(), indexedEdges(to).getFirst().getFromEntity().getId());
  }

  private static List<EsLineageData> indexedEdges(Table table) throws Exception {
    try (var response =
        Entity.getSearchRepository()
            .getSearchClient()
            .getDocByID("table", table.getId().toString())) {
      assertEquals(200, response.getStatus());
      return SearchUtils.getUpstreamLineageListIfExist(JsonUtils.getMap(response.getEntity()));
    }
  }
}
