package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;
import org.openmetadata.service.Entity;

/** Fixtures and reads shared by the domain lineage ITs, all through the API as an admin. */
final class DomainLineageSteps {

  static final ObjectMapper MAPPER = new ObjectMapper();

  private DomainLineageSteps() {}

  static DatabaseSchema newSchema(TestNamespace ns) {
    return DatabaseSchemaTestFactory.createSimple(
        ns, DatabaseServiceTestFactory.createPostgres(ns));
  }

  static Table table(TestNamespace ns, DatabaseSchema schema, String name) {
    return client().tables().create(tableRequest(schema, ns.prefix(name)));
  }

  static CreateTable tableRequest(DatabaseSchema schema, String name) {
    return new CreateTable()
        .withName(name)
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new ColumnBuilder("id", "VARCHAR").dataLength(256).build()));
  }

  static Domain domain(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DOMAIN,
        client()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(name))
                    .withDescription("Domain lineage")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)));
  }

  static Table setTableDomains(Table table, Domain... domains) {
    return setDomains(client().tables(), table.getId(), domains);
  }

  static <T> T setDomains(EntityServiceBase<T> service, UUID id, Domain... domains) {
    ArrayNode refs = MAPPER.createArrayNode();
    for (Domain domain : domains) {
      refs.addObject().put("id", domain.getId().toString()).put("type", Entity.DOMAIN);
    }
    return service.patch(id, patchAdd("/domains", refs));
  }

  static JsonNode patchAdd(String path, JsonNode value) {
    ArrayNode patch = MAPPER.createArrayNode();
    patch.addObject().put("op", "add").put("path", path).set("value", value);
    return patch;
  }

  static void putEdge(EntityInterface<?> from, EntityInterface<?> to) {
    client()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(new LineageDetails())));
  }

  static void deleteEdge(EntityInterface<?> from, EntityInterface<?> to) {
    client()
        .lineage()
        .deleteLineage(
            from.getEntityReference().getType() + ":" + from.getId(),
            to.getEntityReference().getType() + ":" + to.getId());
  }

  static LineageDetails edge(Domain from, Domain to) {
    try {
      String response =
          client().getHttpClient().executeForString(HttpMethod.GET, edgePath(from, to), null);
      return JsonUtils.readValue(
          MAPPER.readTree(response).get("edge").toString(), LineageDetails.class);
    } catch (Exception e) {
      throw new AssertionError("No lineage edge between the domains", e);
    }
  }

  static Integer assetEdges(Domain from, Domain to) {
    return edge(from, to).getAssetEdges();
  }

  static void assertEdgeAbsent(Domain from, Domain to) {
    OpenMetadataException notFound =
        assertThrows(
            OpenMetadataException.class,
            () ->
                client()
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, edgePath(from, to), null));
    assertEquals(404, notFound.getStatusCode());
  }

  private static String edgePath(Domain from, Domain to) {
    return "/v1/lineage/getLineageEdge/" + from.getId() + "/" + to.getId();
  }

  static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}
