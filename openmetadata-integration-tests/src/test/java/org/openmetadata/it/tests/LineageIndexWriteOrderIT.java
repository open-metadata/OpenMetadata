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
    final var fromSchema = DatabaseSchemaTestFactory.createSimple(ns);
    final var toSchema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table from =
        TableTestFactory.createWithName(ns, fromSchema.getFullyQualifiedName(), "from");
    final Table to = TableTestFactory.createWithName(ns, toSchema.getFullyQualifiedName(), "to");
    final var client = SdkClients.adminClient();
    final var edge =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference()));

    client.lineage().addLineage(edge);
    assertIndexedEdge(from.getEntityReference(), to.getEntityReference());
    assertIndexedEdge(from.getService(), to.getService());

    client.lineage().deleteLineage("table:" + from.getId(), "table:" + to.getId());
    assertTrue(
        indexedEdges(to.getEntityReference()).isEmpty(),
        "A successful delete must not leave a background task that can erase a subsequent add");

    assertTrue(
        indexedEdges(to.getService()).isEmpty(),
        "Derived service removal must finish before returning");

    client.lineage().addLineage(edge);
    assertIndexedEdge(from.getEntityReference(), to.getEntityReference());
    assertIndexedEdge(from.getService(), to.getService());
  }

  private static void assertIndexedEdge(final EntityReference from, final EntityReference to)
      throws Exception {
    final List<EsLineageData> edges = indexedEdges(to);
    assertEquals(1, edges.size());
    assertEquals(from.getId(), edges.getFirst().getFromEntity().getId());
  }

  private static List<EsLineageData> indexedEdges(final EntityReference entity) throws Exception {
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
