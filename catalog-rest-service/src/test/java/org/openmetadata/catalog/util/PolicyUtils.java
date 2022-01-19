package org.openmetadata.catalog.util;

import java.util.Random;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.type.MetadataOperation;

@Slf4j
public class PolicyUtils {

  private static final Random random = new Random();

  public static Rule accessControlRule(
      String name,
      String entityTag,
      String entityType,
      String userRole,
      MetadataOperation operation,
      boolean allow,
      int priority,
      boolean enabled) {
    return new Rule()
        .withName(name)
        .withEntityTagAttr(entityTag)
        .withEntityTypeAttr(entityType)
        .withUserRoleAttr(userRole)
        .withOperation(operation)
        .withAllow(allow)
        .withPriority(priority)
        .withEnabled(enabled);
  }

  public static Rule accessControlRule(
      String entityTag,
      String entityType,
      String userRole,
      MetadataOperation operation,
      boolean allow,
      int priority,
      boolean enabled) {
    return accessControlRule(
        "rule" + random.nextInt(21), entityTag, entityType, userRole, operation, allow, priority, enabled);
  }
}
