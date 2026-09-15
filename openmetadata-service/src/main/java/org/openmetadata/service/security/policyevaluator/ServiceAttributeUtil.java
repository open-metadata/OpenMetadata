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

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceAttributes;

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
}
