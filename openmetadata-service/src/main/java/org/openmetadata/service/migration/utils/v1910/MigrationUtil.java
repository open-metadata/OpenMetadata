package org.openmetadata.service.migration.utils.v1910;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;

@Slf4j
public class MigrationUtil {

  public static void removeDuplicateViewAllRules(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy organizationPolicy = repository.findByName("OrganizationPolicy", Include.NON_DELETED);
      List<Rule> rules = organizationPolicy.getRules();
      if (rules == null) {
        LOG.info("OrganizationPolicy has no rules defined, skipping duplicate removal");
        return;
      }

      List<Rule> viewAllRules = new ArrayList<>();
      List<Rule> otherRules = new ArrayList<>();

      for (Rule rule : rules) {
        if (rule.getName() != null && rule.getName().equals("OrganizationPolicy-ViewAll-Rule")) {
          viewAllRules.add(rule);
        } else {
          otherRules.add(rule);
        }
      }

      if (viewAllRules.size() <= 1) {
        LOG.info("No duplicate ViewAll rules found, skipping removal");
        return;
      }

      LOG.info("Found {} duplicate ViewAll rules, keeping the first one", viewAllRules.size());

      // Keep only the first ViewAll rule and all other rules
      List<Rule> updatedRules = new ArrayList<>(otherRules);
      updatedRules.add(viewAllRules.get(0));

      organizationPolicy.setRules(updatedRules);

      collectionDAO
          .policyDAO()
          .update(
              organizationPolicy.getId(),
              organizationPolicy.getFullyQualifiedName(),
              JsonUtils.pojoToJson(organizationPolicy));

      LOG.info(
          "Successfully removed {} duplicate ViewAll rules from OrganizationPolicy",
          viewAllRules.size() - 1);
    } catch (EntityNotFoundException ex) {
      LOG.warn("OrganizationPolicy not found, skipping duplicate ViewAll rule removal");
    } catch (Exception ex) {
      LOG.error(
          "Error removing duplicate ViewAll rules from OrganizationPolicy: {}", ex.getMessage());
    }
  }
}
