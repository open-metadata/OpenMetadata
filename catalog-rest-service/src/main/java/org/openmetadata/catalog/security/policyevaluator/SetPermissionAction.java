package org.openmetadata.catalog.security.policyevaluator;

import org.jeasy.rules.api.Action;
import org.jeasy.rules.api.Facts;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;

class SetPermissionAction implements Action {

  private final Rule rule;

  public SetPermissionAction(Rule rule) {
    this.rule = rule;
  }

  @Override
  public void execute(Facts facts) throws Exception {
    facts.put(CommonFields.ALLOW, this.rule.getAllow());
  }
}
