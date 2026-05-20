package org.openmetadata.service.migration.utils.v1129;

import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addOperationsToPolicyRule;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  /**
   * Retrofits seeded bot policies that grant broad {@code EditAll} on {@code ["All"]} resources
   * with the {@code Trigger} operation. Pre-fix these identities could trigger pipelines because
   * {@code /trigger} skipped authz; the migration preserves that behavior under the new authz
   * enforcement (GH-27962).
   *
   * <p>Each entry is idempotent via {@link
   * org.openmetadata.service.migration.utils.v160.MigrationUtil#addOperationsToPolicyRule}.
   */
  public static void addTriggerOperationToDefaultBotPolicies(CollectionDAO collectionDAO) {
    record PolicyRule(String policy, String rule) {}
    List<PolicyRule> targets =
        List.of(
            new PolicyRule("IngestionBotPolicy", "IngestionBotRule-Allow"),
            new PolicyRule("LineageBotPolicy", "LineageBotRule-Allow"),
            new PolicyRule("ProfilerBotPolicy", "ProfilerBotBotRule-Allow"),
            new PolicyRule("QualityBotPolicy", "QualityBotBotRule-Allow"),
            new PolicyRule("UsageBotPolicy", "UsageBotRule-Allow-Usage"));
    for (PolicyRule t : targets) {
      addOperationsToPolicyRule(
          t.policy(), t.rule(), List.of(MetadataOperation.TRIGGER), collectionDAO);
    }
  }

  /**
   * Adds a dedicated {@code DataStewardPolicy-TriggerRule} to the existing {@code
   * DataStewardPolicy} if not already present. Data stewards already have {@code EditOwners} on
   * all resources, so they could already reach trigger via an ownership rewrite; this rule makes
   * the capability explicit for audit clarity rather than burying it inside the existing edit
   * rule.
   *
   * <p>Mirrors the new-rule shape used by {@code
   * v180.MigrationUtil.addDenyDisplayNameRuleToBotPolicies}. Idempotent — skips when the rule
   * already exists.
   */
  public static void addTriggerRuleToDataStewardPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName("DataStewardPolicy", Include.NON_DELETED);
      boolean hasTriggerRule =
          policy.getRules().stream()
              .anyMatch(
                  r ->
                      "DataStewardPolicy-TriggerRule".equals(r.getName())
                          && r.getEffect() == Rule.Effect.ALLOW
                          && r.getOperations() != null
                          && r.getOperations().contains(MetadataOperation.TRIGGER));
      if (!hasTriggerRule) {
        Rule triggerRule =
            new Rule()
                .withName("DataStewardPolicy-TriggerRule")
                .withResources(List.of("all"))
                .withOperations(List.of(MetadataOperation.TRIGGER))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(triggerRule);
        collectionDAO
            .policyDAO()
            .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
        LOG.info("Added DataStewardPolicy-TriggerRule to DataStewardPolicy");
      } else {
        LOG.debug("DataStewardPolicy already has TriggerRule, skipping");
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("DataStewardPolicy not found, skipping TriggerRule addition");
    }
  }
}
