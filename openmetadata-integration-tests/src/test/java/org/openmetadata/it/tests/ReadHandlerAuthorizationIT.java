package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Hand-written read handlers authorize like the entity reads beside them: a caller denied a
 * resource gets 403 from them too.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ReadHandlerAuthorizationIT {

  @Test
  void teamHierarchyNeedsViewOnTeams(TestNamespace ns) {
    assertRefused(
        denied(ns, "teams", Entity.TEAM, MetadataOperation.VIEW_ALL), "/v1/teams/hierarchy");
  }

  @Test
  void roleListingNeedsViewOnRoles(TestNamespace ns) {
    assertRefused(denied(ns, "roles", Entity.ROLE, MetadataOperation.VIEW_ALL), "/v1/roles");
  }

  @Test
  void taskCountNeedsViewOnTasks(TestNamespace ns) {
    assertRefused(denied(ns, "tasks", Entity.TASK, MetadataOperation.VIEW_ALL), "/v1/tasks/count");
  }

  @Test
  void domainHierarchyNeedsViewOnDomains(TestNamespace ns) {
    assertRefused(
        denied(ns, "domains", Entity.DOMAIN, MetadataOperation.VIEW_ALL), "/v1/domains/hierarchy");
  }

  @Test
  void customPropertyReadsNeedViewOnTypes(TestNamespace ns) {
    OpenMetadataClient denied = denied(ns, "types", Entity.TYPE, MetadataOperation.VIEW_ALL);
    for (String path :
        List.of(
            "/v1/metadata/types/customProperties",
            "/v1/metadata/types/name/table/customProperties",
            "/v1/metadata/types/fields/table")) {
      assertRefused(denied, path);
    }
  }

  @Test
  void profilerConfigurationIsDecidedOnTablesWhateverTypeIsAsked(TestNamespace ns) {
    assertRefused(
        denied(ns, "profiler", Entity.TABLE, MetadataOperation.VIEW_PROFILER_GLOBAL_CONFIGURATION),
        "/v1/system/settings/profilerConfiguration?entityType=topic");
  }

  private static void assertRefused(OpenMetadataClient client, String path) {
    assertThrows(
        ForbiddenException.class,
        () -> client.getHttpClient().executeForString(HttpMethod.GET, path, null),
        path);
  }

  private static OpenMetadataClient denied(
      TestNamespace ns, String label, String resource, MetadataOperation operation) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("deny_" + label))
                    .withDescription("Denies " + operation + " on " + resource)
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("deny_" + label)
                                .withResources(List.of(resource))
                                .withOperations(List.of(operation))
                                .withEffect(Rule.Effect.DENY))));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("deny_" + label + "_role"))
                    .withDescription("Role denying " + resource)
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    String name = "rh_" + label + "_" + UUID.randomUUID().toString().substring(0, 8);
    String email = name + "@test.openmetadata.org";
    ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId()))));
    return SdkClients.createClient(email, email, new String[] {});
  }
}
