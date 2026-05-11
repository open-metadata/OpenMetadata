package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Verifies that the live mapping for every declared alias carries the canonical OM
 * envelope fields ({@code id}, {@code entityType}, {@code deleted}, {@code
 * fullyQualifiedName}). A regression that drops or renames any of these silently
 * breaks search queries that filter on them, so the test asserts the contract
 * directly against the running engine.
 *
 * <p>Skips aliases that resolve to no backing index (e.g., index types only created
 * on-demand for entities that haven't been seeded yet).
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class IndexMappingTemplatesIT {

  private static final List<String> REQUIRED_FIELDS =
      List.of("id", "entityType", "deleted", "fullyQualifiedName");

  private static ServerHandle server;
  private static IndexAliasInspector inspector;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    inspector = new IndexAliasInspector(server);
    Apps.setDefaultClient(SdkClients.adminClient());
    ReindexHelpers.triggerSearchIndexAndWait(server);
  }

  @Test
  void everyDeclaredAliasHasCanonicalEnvelopeFields() {
    final List<String> failures = new ArrayList<>();
    for (final String entityType : inspector.declaredEntityTypes()) {
      final String alias = inspector.aliasFor(entityType);
      if (inspector.indicesForAlias(alias).isEmpty()) {
        continue;
      }
      final JsonNode mapping = inspector.mapping(alias);
      final JsonNode properties = mapping.path("properties");
      for (final String field : REQUIRED_FIELDS) {
        if (properties.path(field).isMissingNode() || properties.path(field).isEmpty()) {
          failures.add(String.format("  %s: missing required field '%s' in mapping", alias, field));
        }
      }
    }
    assertThat(failures)
        .as("every alias must declare canonical envelope fields:%n%s", String.join("\n", failures))
        .isEmpty();
  }
}
