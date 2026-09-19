/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.policyevaluator;

import java.lang.reflect.Method;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EnumInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceAttributes;
import org.openmetadata.service.Entity;

/**
 * Reads service attributes off a resolved service entity for the policy conditions. Shared by the
 * read and create resource contexts, which resolve the service differently but answer the same
 * questions about it.
 */
final class ServiceAttributeUtil {

  private ServiceAttributeUtil() {}

  /** Connector type ({@code Snowflake}, {@code Postgres}), or null if unknown. */
  static String serviceTypeOf(EntityInterface service) {
    if (service instanceof ServiceEntityInterface typedService
        && typedService.getServiceType() != null) {
      return typedService.getServiceType().value();
    }
    return null;
  }

  /** Declared environment, or null when unset — the attributes block is optional. */
  static String environmentOf(EntityInterface service) {
    if (!(service instanceof ServiceEntityInterface typedService)) {
      return null;
    }
    ServiceAttributes attributes = typedService.getServiceAttributes();
    if (attributes == null || attributes.getEnvironment() == null) {
      return null;
    }
    return attributes.getEnvironment().value();
  }

  /**
   * True when {@code serviceType} is a connector type some service schema declares. Comparison is
   * case-insensitive, matching how the condition evaluates.
   *
   * <p>Answers true when the set cannot be built — during bootstrap, or in a test that registers
   * only the entities it exercises. Refusing every value there would block legitimate policy
   * creation, which is worse than the typo this check exists to catch.
   */
  static boolean isKnownServiceType(String serviceType) {
    Set<String> known = serviceTypes();
    return known.isEmpty() || known.contains(serviceType.toLowerCase(Locale.ROOT));
  }

  /**
   * Every connector type any service schema declares — {@code Snowflake}, {@code Postgres},
   * {@code Looker}. Read off each service entity's {@code getServiceType()} return type; the bridge
   * method declared by {@link ServiceEntityInterface} returns {@code EnumInterface}, so it is
   * skipped in favour of the covariant override that returns the concrete enum.
   *
   * <p>Recomputed per call rather than memoized. This runs only when a policy is written, so the
   * reflection is not on any hot path, and caching it would pin whatever was registered at the
   * first call — an empty set during bootstrap would disable the check for the life of the process.
   */
  static Set<String> serviceTypes() {
    Set<String> types = new HashSet<>();
    for (String serviceEntityType : Entity.getServiceEntityTypes()) {
      if (!Entity.hasEntityRepository(serviceEntityType)) {
        continue;
      }
      Class<?> entityClass = Entity.getEntityRepository(serviceEntityType).getEntityClass();
      collectServiceTypes(entityClass, types);
    }
    return Set.copyOf(types);
  }

  private static void collectServiceTypes(Class<?> entityClass, Set<String> types) {
    if (entityClass == null) {
      return;
    }
    for (Method method : entityClass.getMethods()) {
      if (!SERVICE_TYPE_GETTER.equals(method.getName()) || method.isBridge()) {
        continue;
      }
      Object[] constants = method.getReturnType().getEnumConstants();
      if (constants == null) {
        continue;
      }
      for (Object constant : constants) {
        if (constant instanceof EnumInterface value) {
          types.add(value.value().toLowerCase(Locale.ROOT));
        }
      }
    }
  }

  private static final String SERVICE_TYPE_GETTER = "getServiceType";
}
