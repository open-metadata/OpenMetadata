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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.search.SearchUtils;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class LineageIndexWriteOrderIT {

  @Test
  void deletionIsIndexedBeforeItsResponseAndAReplacementIsRetained(final TestNamespace ns)
      throws Exception {
    final TableEdge edge = TableEdge.create(ns);
    edge.add();
    edge.assertIndexed();
    edge.delete();
    assertTrue(indexedEdges(edge.to().getEntityReference()).isEmpty());
    assertTrue(indexedEdges(edge.to().getService()).isEmpty());
    edge.add();
    edge.assertIndexed();
  }

  record TableEdge(Table from, Table to) {
    static TableEdge create(final TestNamespace ns) {
      return new TableEdge(table(ns, "from"), table(ns, "to"));
    }

    private static Table table(final TestNamespace ns, final String name) {
      final var schema = DatabaseSchemaTestFactory.createSimple(ns);
      return TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), name);
    }

    void add() {
      final var edge =
          new EntitiesEdge()
              .withFromEntity(from.getEntityReference())
              .withToEntity(to.getEntityReference());
      SdkClients.adminClient().lineage().addLineage(new AddLineage().withEdge(edge));
    }

    void delete() {
      SdkClients.adminClient()
          .lineage()
          .deleteLineage("table:" + from.getId(), "table:" + to.getId());
    }

    void assertIndexed() throws Exception {
      assertIndexedEdge(from.getEntityReference(), to.getEntityReference());
      assertIndexedEdge(from.getService(), to.getService());
    }
  }

  static void assertIndexedEdge(final EntityReference from, final EntityReference to)
      throws Exception {
    final List<EsLineageData> edges = indexedEdges(to);
    assertEquals(1, edges.size());
    assertEquals(from.getId(), edges.getFirst().getFromEntity().getId());
  }

  static List<EsLineageData> indexedEdges(final EntityReference entity) throws Exception {
    final String document =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/search/get/" + entity.getType() + "/doc/" + entity.getId(),
                null);
    return SearchUtils.getUpstreamLineageListIfExist(JsonUtils.getMapFromJson(document));
  }
}
