package org.openmetadata.catalog.security.policyevaluator;

/**
 * CommonFields defines all the fields used within the Rules and Facts for the RulesEngine used by {@link
 * PolicyEvaluator}
 */
class CommonFields {
  static String ALLOW = "allow";
  static String ENTITY_TAGS = "entityTags";
  static String ENTITY_TYPE = "entityType";
  static String OPERATION = "operation";
  static String USER_ROLES = "userRoles";

  // By default, if no rule matches, do not grant access.
  static boolean DEFAULT_ACCESS = false;
}
