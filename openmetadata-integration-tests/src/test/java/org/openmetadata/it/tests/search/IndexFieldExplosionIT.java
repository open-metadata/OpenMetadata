package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Verifies the mapping field count stays bounded under load that historically caused
 * field explosions:
 *
 * <ul>
 *   <li>creating many child tables under a single schema must NOT scale the
 *       database_schema mapping field count (#23514-class regression);
 *   <li>adding many custom properties to an entity type must NOT scale the entity's
 *       index mapping field count — custom properties are de-normalized into a
 *       flattened/object envelope, not exploded into top-level fields.
 * </ul>
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class IndexFieldExplosionIT {

  private static final int CUSTOM_PROPERTIES_TO_ADD = 30;
  private static final int CHILD_TABLES = 50;
  private static final int BASELINE_CHILD_TABLES = 3;

  private static ServerHandle server;
  private static IndexAliasInspector inspector;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    inspector = new IndexAliasInspector(server);
    Apps.setDefaultClient(SdkClients.adminClient());
    // Recreate the baseline so the (cluster-alias-prefixed) indices exist/queryable even if a
    // prior search IT dropped or left them unswapped.
    ReindexHelpers.recreateAllAndWait(server, ReindexHelpers.reindexTimeout());
  }

  @Test
  void manyChildTablesDoNotInflateSchemaMappingFieldCount(final TestNamespace ns) {
    final String schemaIndex = inspector.indexNameFor("databaseSchema");
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);

    // Baseline against a schema that already has a few indexed children, so any one-time
    // dynamic field a populated schema doc introduces is already in the mapping. The assertion
    // then isolates the regression we guard against: the field count must not grow with the
    // NUMBER of child tables (#23514), as opposed to merely having children at all.
    for (int i = 0; i < BASELINE_CHILD_TABLES; i++) {
      TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "seed" + i);
    }
    ReindexHelpers.triggerSearchIndexAndWait(server);
    final long schemaBefore = inspector.fieldCount(schemaIndex);

    for (int i = 0; i < CHILD_TABLES; i++) {
      TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "child" + i);
    }
    ReindexHelpers.triggerSearchIndexAndWait(server);

    final long schemaAfter = inspector.fieldCount(schemaIndex);
    assertThat(schemaAfter)
        .as(
            "databaseSchema mapping field count must not scale with child tables (before=%d after=%d)",
            schemaBefore, schemaAfter)
        .isEqualTo(schemaBefore);
  }

  @Test
  void customPropertiesDoNotInflateTableMappingFieldCount() throws Exception {
    final String tableIndex = inspector.indexNameFor("table");
    final long tableBefore = inspector.fieldCount(tableIndex);
    final OpenMetadataClient client = SdkClients.adminClient();
    final Type tableType = getTypeByName(client, "table");
    final Type stringType = getTypeByName(client, "string");

    final String runTag = UUID.randomUUID().toString().substring(0, 8);
    for (int i = 0; i < CUSTOM_PROPERTIES_TO_ADD; i++) {
      final CustomProperty property = new CustomProperty();
      property.setName("explosionCheck_" + runTag + "_" + i);
      property.setDescription("Field-explosion regression probe " + i);
      property.setPropertyType(stringType.getEntityReference().withType(Entity.TYPE));
      client
          .getHttpClient()
          .execute(HttpMethod.PUT, "/v1/metadata/types/" + tableType.getId(), property, Type.class);
    }
    ReindexHelpers.triggerSearchIndexAndWait(server);

    final long tableAfter = inspector.fieldCount(tableIndex);
    assertThat(tableAfter)
        .as(
            "table mapping field count must not scale with custom properties (before=%d after=%d, added=%d)",
            tableBefore, tableAfter, CUSTOM_PROPERTIES_TO_ADD)
        .isEqualTo(tableBefore);
  }

  private static Type getTypeByName(final OpenMetadataClient client, final String name) {
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/metadata/types/name/" + name, null, Type.class);
  }
}
