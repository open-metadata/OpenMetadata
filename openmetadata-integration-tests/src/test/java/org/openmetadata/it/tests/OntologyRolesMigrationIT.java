package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.migration.utils.v210.OntologyRolesMigration;

/**
 * Exercises the 2.1.0 step that gives the DataSteward role of an installed catalog the ontology
 * policies, against the real database.
 */
@Isolated("detaches policies from the shared DataSteward role")
@ExtendWith(TestNamespaceExtension.class)
class OntologyRolesMigrationIT {
  private static final List<String> ONTOLOGY_POLICIES =
      List.of("OntologyAuthorPolicy", "OntologyReviewerPolicy");

  @Test
  void upgradeAttachesEachPolicyOnceAndLeavesCustomPoliciesAlone(TestNamespace ns) {
    final Role steward = SdkClients.adminClient().roles().getByName("DataSteward");
    final Policy custom =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("stewardCustom"))
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("custom")
                                .withResources(List.of("all"))
                                .withOperations(List.of(MetadataOperation.VIEW_ALL))
                                .withEffect(Rule.Effect.ALLOW))));
    attach(steward.getId(), custom.getId());
    for (final String name : ONTOLOGY_POLICIES) {
      detach(steward.getId(), policyId(name));
    }
    final List<String> beforeUpgrade = policyNames();
    assertEquals(List.of(), beforeUpgrade.stream().filter(ONTOLOGY_POLICIES::contains).toList());

    try {
      OntologyRolesMigration.attachOntologyPoliciesToDataSteward(Entity.getCollectionDAO());
      OntologyRolesMigration.attachOntologyPoliciesToDataSteward(Entity.getCollectionDAO());

      final List<String> afterTwoRuns = policyNames();
      assertEquals(1, afterTwoRuns.stream().filter("OntologyAuthorPolicy"::equals).count());
      assertEquals(1, afterTwoRuns.stream().filter("OntologyReviewerPolicy"::equals).count());
      assertEquals(
          beforeUpgrade.stream().sorted().toList(),
          afterTwoRuns.stream()
              .filter(name -> !ONTOLOGY_POLICIES.contains(name))
              .sorted()
              .toList());
    } finally {
      OntologyRolesMigration.attachOntologyPoliciesToDataSteward(Entity.getCollectionDAO());
      detach(steward.getId(), custom.getId());
      SdkClients.adminClient()
          .policies()
          .delete(custom.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  private static List<String> policyNames() {
    final JsonNode json =
        JsonUtils.readTree(
            JsonUtils.pojoToJson(
                SdkClients.adminClient().roles().getByName("DataSteward", "policies")));
    final List<String> names = new ArrayList<>();
    json.get("policies").forEach(policy -> names.add(policy.get("name").asText()));
    return names;
  }

  private static UUID policyId(final String name) {
    return SdkClients.adminClient().policies().getByName(name).getId();
  }

  private static void attach(final UUID role, final UUID policy) {
    Entity.getCollectionDAO()
        .relationshipDAO()
        .insert(role, policy, Entity.ROLE, Entity.POLICY, Relationship.HAS.ordinal());
  }

  private static void detach(final UUID role, final UUID policy) {
    Entity.getCollectionDAO()
        .relationshipDAO()
        .delete(role, Entity.ROLE, policy, Entity.POLICY, Relationship.HAS.ordinal());
  }
}
