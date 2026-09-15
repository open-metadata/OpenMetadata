package org.openmetadata.service.entity;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.util.Arrays;
import java.util.HashSet;

/** Supplies real schema policies even when a test replaces the global entity registry. */
public final class EntityFieldPolicyFixture {
  private EntityFieldPolicyFixture() {}

  public static EntityFieldPolicy forEntity(final Class<?> type) {
    return new EntityFieldPolicy(
        new HashSet<>(Arrays.asList(type.getAnnotation(JsonPropertyOrder.class).value())));
  }
}
