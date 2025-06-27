package org.openmetadata.service.migration.utils.v180;

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

  public static void addCertificationOperationsToPolicy(CollectionDAO collectionDAO) {

    addOperationsToPolicyRule(
        "DataConsumerPolicy",
        "DataConsumerPolicy-EditRule",
        List.of(MetadataOperation.EDIT_CERTIFICATION),
        collectionDAO);

    addOperationsToPolicyRule(
        "DataStewardPolicy",
        "DataStewardPolicy-EditRule",
        List.of(MetadataOperation.EDIT_CERTIFICATION),
        collectionDAO);
  }

  public static void addDenyDisplayNameRuleToBotPolicies(CollectionDAO collectionDAO) {
    List<String> botPolicies =
        List.of(
            "ApplicationBotPolicy",
            "AutoClassificationBotPolicy",
            "DefaultBotPolicy",
            "IngestionBotPolicy",
            "LineageBotPolicy",
            "ProfilerBotPolicy",
            "QualityBotPolicy",
            "UsageBotPolicy");

    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);

    for (String policyName : botPolicies) {
      try {
        Policy policy = repository.findByName(policyName, Include.NON_DELETED);
        boolean hasDenyDisplayName =
            policy.getRules().stream()
                .anyMatch(
                    r ->
                        "DisplayName-Deny".equals(r.getName())
                            && r.getEffect() == Rule.Effect.DENY
                            && r.getOperations().contains(MetadataOperation.EDIT_DISPLAY_NAME));
        if (!hasDenyDisplayName) {
          Rule denyRule =
              new Rule()
                  .withName("DisplayName-Deny")
                  .withResources(List.of("All"))
                  .withOperations(List.of(MetadataOperation.EDIT_DISPLAY_NAME))
                  .withEffect(Rule.Effect.DENY)
                  .withDescription("Deny bots to update display name");

          policy.getRules().add(denyRule);

          collectionDAO
              .policyDAO()
              .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));

          LOG.info("Added DisplayName-Deny rule to {}", policyName);
        } else {
          LOG.debug("Policy {} already has a DisplayName-Deny rule, skipping", policyName);
        }
      } catch (EntityNotFoundException ex) {
        LOG.warn("Policy {} not found, skipping", policyName);
      } catch (Exception e) {
        LOG.error("Failed to update policy {}: {}", policyName, e.getMessage(), e);
      }
    }
  }
}
