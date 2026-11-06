package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;

/**
 * Regression guard for the {@code owners}-must-be-{@code nested} mapping class (issues #5, #6;
 * fix PR #26982): 13 index mapping files (including locale variants jp/ru/zh, and
 * column/mcp/query-cost/security-service indexes) shipped {@code owners} as an {@code object}
 * instead of {@code nested}. RBAC filters every landing-page search with a {@code nested} query on
 * {@code owners}; against an {@code object} mapping that throws
 * {@code [nested] nested object under path [owners] is not of nested type}, failing the whole
 * shard — so the entire entity type drops out of search for non-admins.
 *
 * <p>This asserts that <b>every</b> live index that carries an {@code owners} field maps it as
 * {@code nested}. It sweeps all aliases (via {@link IndexAliasInspector#aliasToIndex()}) so a newly
 * added or regenerated index mapping that reintroduces an {@code object} {@code owners} fails here
 * rather than in a customer's RBAC search. (Locale-variant {@code .json} files are covered by
 * whichever locale the cluster was booted with; the bug class is structural and identical across
 * locales.)
 */
class OwnersNestedMappingIT {

  private static final String OWNERS_FIELD = "owners";
  private static final String NESTED_TYPE = "nested";

  @Test
  void everyIndexThatHasOwnersMapsItAsNested() {
    final ServerHandle server = OssTestServer.defaultHandle();
    final IndexAliasInspector indices = new IndexAliasInspector(server);

    final Map<String, String> offenders = new TreeMap<>();
    indices
        .aliasToIndex()
        .keySet()
        .forEach(alias -> collectOwnersOffender(indices, alias, offenders));

    assertThat(offenders)
        .as("indexes whose 'owners' field is not mapped as 'nested' (RBAC nested query breaks)")
        .isEmpty();
  }

  private static void collectOwnersOffender(
      final IndexAliasInspector indices, final String alias, final Map<String, String> offenders) {
    final JsonNode owners = indices.mapping(alias).path(OWNERS_FIELD);
    if (!owners.isMissingNode() && !owners.path("type").isMissingNode()) {
      final String type = owners.path("type").asText();
      if (!NESTED_TYPE.equals(type)) {
        offenders.put(alias, type);
      }
    }
  }
}
