package org.openmetadata.service.migration.utils.v1129;

import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addOperationsToPolicyRule;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  /**
   * Retrofits default seeded policies that grant broad edit capability with the {@code Trigger}
   * operation, keeping pre-existing customer behavior intact after {@code /trigger} starts
   * enforcing authz (GH-27962).
   *
   * <p>Targets the rules whose resources are {@code "All"} and that already grant {@code EditAll}
   * (the broad-bot allow rules) plus {@code DataStewardPolicy} which grants {@code EditOwners} —
   * stewards can already reach trigger via the ownership-edit escalation path, so granting it
   * explicitly aligns the policy with the effective capability and improves the audit trail.
   *
   * <p>Each call is idempotent via {@link
   * org.openmetadata.service.migration.utils.v160.MigrationUtil#addOperationsToPolicyRule}.
   */
  public static void addTriggerOperationToDefaultPolicies(CollectionDAO collectionDAO) {
    record PolicyRule(String policy, String rule) {}
    List<PolicyRule> targets =
        List.of(
            new PolicyRule("IngestionBotPolicy", "IngestionBotRule-Allow"),
            new PolicyRule("LineageBotPolicy", "LineageBotRule-Allow"),
            new PolicyRule("ProfilerBotPolicy", "ProfilerBotBotRule-Allow"),
            new PolicyRule("QualityBotPolicy", "QualityBotBotRule-Allow"),
            new PolicyRule("UsageBotPolicy", "UsageBotRule-Allow-Usage"),
            new PolicyRule("DataStewardPolicy", "DataStewardPolicy-EditRule"));
    for (PolicyRule t : targets) {
      addOperationsToPolicyRule(
          t.policy(), t.rule(), List.of(MetadataOperation.TRIGGER), collectionDAO);
    }
  }
}
