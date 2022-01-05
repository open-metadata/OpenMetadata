package org.openmetadata.catalog.security.policyevaluator;

/**
 * CommonFields defines all the fields used within the Rules and Facts for the RulesEngine used by {@link
 * PolicyEvaluator}
 */
class CommonFields {
  static final String ALLOW = "allow";
  static final String ENTITY_TAGS = "entityTags";
  static final String ENTITY_TYPE = "entityType";
  static final String OPERATION = "operation";
  static final String USER_ROLES = "userRoles";

  // By default, if no rule matches, do not grant access.
  static final boolean DEFAULT_ACCESS = false;
}
