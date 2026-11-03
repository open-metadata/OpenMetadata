package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.Entity;

/**
 * The owner of a test definition has All on it, its SQL expression included, and data quality runs
 * that SQL on the service connection. So an unowned one cannot be claimed through the NoOwner rule
 * (ADR:2026-11-03-owners-of-configuration-entities-need-edit-all).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TestDefinitionOwnershipIT {

  @Test
  void anUnownedTestDefinitionCannotBeClaimedWithoutEditAll(TestNamespace ns) {
    assumeFalse(
        OssTestServer.isExternalMode(),
        "Signs the claimer's token with the harness key, which a deployed cluster rejects");
    OpenMetadataClient admin = SdkClients.adminClient();
    TestDefinition definition =
        admin
            .testDefinitions()
            .create(
                new CreateTestDefinition()
                    .withName(ns.prefix("unownedDefinition"))
                    .withDescription("Test definition created without owners")
                    .withEntityType(TestDefinitionEntityType.TABLE)
                    .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA)));
    try {
      User claimer = UserTestFactory.createUser(ns, "td_claimer");
      OpenMetadataClient asClaimer =
          SdkClients.createClient(claimer.getName(), claimer.getEmail(), new String[] {});
      JsonNode claim = ownedBy(claimer);

      assertThrows(
          ForbiddenException.class,
          () -> asClaimer.testDefinitions().patch(definition.getId(), claim));
      assertDoesNotThrow(() -> admin.testDefinitions().patch(definition.getId(), claim));
    } finally {
      admin.testDefinitions().delete(definition.getId().toString(), Map.of("hardDelete", "true"));
    }
  }

  private static JsonNode ownedBy(User user) {
    return JsonUtils.valueToTree(
        List.of(
            Map.of(
                "op",
                "add",
                "path",
                "/owners",
                "value",
                List.of(Map.of("id", user.getId().toString(), "type", Entity.USER)))));
  }
}
