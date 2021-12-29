package org.openmetadata.catalog.security.policyevaluator;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Condition;
import org.jeasy.rules.api.Facts;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.type.MetadataOperation;

@Slf4j
class RuleCondition implements Condition {

  private final Rule rule;

  public RuleCondition(Rule rule) {
    this.rule = rule;
  }

  public boolean isValid() {
    // TODO: This needs to be moved to Policy Repository rule creation, so that rules are always valid.
    // At least one of the attributes must be specified in addition to the operation for a rule to be valid.
    log.debug("Validating rule condition - rule: {}", rule);
    return rule.getOperation() != null
        && (rule.getEntityTagAttr() != null || rule.getEntityTypeAttr() != null || rule.getUserRoleAttr() != null);
  }

  @Override
  public boolean evaluate(Facts facts) {
    // Check against operation and each of the entity and user attributes.

    MetadataOperation operation = facts.get(CommonFields.OPERATION);
    if (!operation.equals(rule.getOperation())) {
      return false;
    }

    List<String> entityTags = facts.get(CommonFields.ENTITY_TAGS);
    if (rule.getEntityTagAttr() != null && !entityTags.contains(rule.getEntityTagAttr())) {
      return false;
    }

    String entityType = facts.get(CommonFields.ENTITY_TYPE);
    if (rule.getEntityTypeAttr() != null && !entityType.equals(rule.getEntityTypeAttr())) {
      return false;
    }

    List<String> userRoles = facts.get(CommonFields.USER_ROLES);
    return rule.getUserRoleAttr() == null || userRoles.contains(rule.getUserRoleAttr());
  }
}
