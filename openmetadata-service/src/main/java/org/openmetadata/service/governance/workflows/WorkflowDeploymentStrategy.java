package org.openmetadata.service.governance.workflows;

/**
 * Strategy interface for controlling workflow deployment behavior.
 * This provides a more flexible and testable approach than ThreadLocal.
 */
public interface WorkflowDeploymentStrategy {

  /**
   * Determines if workflow deployment should be performed.
   *
   * @param context The deployment context (e.g., "create", "update", "delete", "transaction")
   * @return true if deployment should proceed, false to skip
   */
  boolean shouldDeploy(String context);

  /**
   * Default strategy that always deploys
   */
  WorkflowDeploymentStrategy ALWAYS_DEPLOY = context -> true;

  /**
   * Strategy that never deploys (useful for batch operations)
   */
  WorkflowDeploymentStrategy NEVER_DEPLOY = context -> false;

  /**
   * Strategy that only deploys outside of transactions
   */
  WorkflowDeploymentStrategy DEPLOY_OUTSIDE_TRANSACTION = context -> !"transaction".equals(context);
}
