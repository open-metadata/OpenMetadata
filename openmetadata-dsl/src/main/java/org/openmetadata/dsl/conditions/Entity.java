package org.openmetadata.dsl.conditions;

import java.util.Arrays;
import org.openmetadata.dsl.core.DSLCondition;

public class Entity {

  public static DSLCondition ofType(String entityType) {
    return DSLCondition.builder()
        .expression("Entity.ofType(\"" + entityType + "\")")
        .type("entity")
        .build();
  }

  public static DSLCondition ofTypes(String... entityTypes) {
    String types = String.join("\", \"", entityTypes);
    return DSLCondition.builder()
        .expression("Entity.ofTypes([\"" + types + "\"])")
        .type("entity")
        .build();
  }

  public static DSLCondition hasOwner(String... owners) {
    return new EntityConditionBuilder().hasOwner(owners).build();
  }

  public static DSLCondition hasNoOwner() {
    return new EntityConditionBuilder().hasNoOwner().build();
  }

  public static DSLCondition hasTag(String tag) {
    return new EntityConditionBuilder().hasTag(tag).build();
  }

  public static DSLCondition belongsToTable(String pattern) {
    return new EntityConditionBuilder().belongsToTable(pattern).build();
  }

  public static DSLCondition belongsToDomain(String domain) {
    return new EntityConditionBuilder().belongsToDomain(domain).build();
  }

  public static DSLCondition fieldChanged(String... fields) {
    return new EntityConditionBuilder().fieldChanged(fields).build();
  }

  public static DSLCondition status(String status) {
    return new EntityConditionBuilder().status(status).build();
  }

  public static EntityConditionBuilder createdMoreThanDaysAgo(int days) {
    return new EntityConditionBuilder().createdMoreThanDaysAgo(days);
  }

  public static EntityConditionBuilder lastModifiedMoreThanDaysAgo(int days) {
    return new EntityConditionBuilder().lastModifiedMoreThanDaysAgo(days);
  }

  public static EntityConditionBuilder businessHours() {
    return new EntityConditionBuilder().businessHours();
  }

  public static EntityConditionBuilder weekday() {
    return new EntityConditionBuilder().weekday();
  }

  public static EntityConditionBuilder environment(String env) {
    return new EntityConditionBuilder().environment(env);
  }

  public static EntityConditionBuilder underMaintenance() {
    return new EntityConditionBuilder().underMaintenance();
  }

  public static EntityConditionBuilder not(DSLCondition condition) {
    return new EntityConditionBuilder().not(condition);
  }

  public static EntityConditionBuilder or(DSLCondition... conditions) {
    return new EntityConditionBuilder().or(conditions);
  }

  // Entity Condition Builder Class
  public static class EntityConditionBuilder {
    private String expression = "";

    public EntityConditionBuilder hasOwner(String... owners) {
      String ownersList = "[\"" + String.join("\", \"", owners) + "\"]";
      expression += ".hasOwner(" + ownersList + ")";
      return this;
    }

    public EntityConditionBuilder hasNoOwner() {
      expression += ".hasNoOwner()";
      return this;
    }

    public EntityConditionBuilder hasTag(String tag) {
      expression += ".hasTag(\"" + tag + "\")";
      return this;
    }

    public EntityConditionBuilder belongsToTable(String pattern) {
      expression += ".belongsToTable(matching(\"" + pattern + "\"))";
      return this;
    }

    public EntityConditionBuilder belongsToDomain(String domain) {
      expression += ".belongsToDomain(\"" + domain + "\")";
      return this;
    }

    public EntityConditionBuilder fieldChanged(String... fields) {
      String fieldsList = "[\"" + String.join("\", \"", fields) + "\"]";
      expression += ".fieldChanged(" + fieldsList + ")";
      return this;
    }

    public EntityConditionBuilder status(String status) {
      expression += ".status(\"" + status + "\")";
      return this;
    }

    public EntityConditionBuilder createdMoreThanDaysAgo(int days) {
      expression += ".createdMoreThanDaysAgo(" + days + ")";
      return this;
    }

    public EntityConditionBuilder lastModifiedMoreThanDaysAgo(int days) {
      expression += ".lastModifiedMoreThanDaysAgo(" + days + ")";
      return this;
    }

    public EntityConditionBuilder businessHours() {
      expression += ".businessHours()";
      return this;
    }

    public EntityConditionBuilder weekday() {
      expression += ".weekday()";
      return this;
    }

    public EntityConditionBuilder environment(String env) {
      expression += ".environment(\"" + env + "\")";
      return this;
    }

    public EntityConditionBuilder underMaintenance() {
      expression += ".underMaintenance()";
      return this;
    }

    public EntityConditionBuilder not(DSLCondition condition) {
      expression += ".not(" + condition.getExpression() + ")";
      return this;
    }

    public EntityConditionBuilder or(DSLCondition... conditions) {
      String conditionsList =
          String.join(
              ", ", Arrays.stream(conditions).map(c -> c.getExpression()).toArray(String[]::new));
      expression += ".or(" + conditionsList + ")";
      return this;
    }

    public DSLCondition and(DSLCondition other) {
      return DSLCondition.builder()
          .expression(expression + " && " + other.getExpression())
          .type("logical")
          .build();
    }

    public DSLCondition build() {
      return DSLCondition.builder().expression(expression).type("entity").build();
    }

    // Implicit conversion to DSLCondition
    public String getExpression() {
      return expression;
    }
  }
}
