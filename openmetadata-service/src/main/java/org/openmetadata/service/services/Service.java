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

package org.openmetadata.service.services;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation for marking service classes that should be automatically discovered and registered.
 *
 * <p>Services annotated with @Service will be automatically discovered by ServiceRegistry and
 * registered with their entity type. This follows the same pattern as @Repository and @Collection
 * annotations for automatic discovery.
 *
 * <p>Example usage:
 *
 * <pre>
 * &#64;Service(entityType = Entity.TABLE)
 * public class TableService implements EntityService&lt;Table&gt; {
 *   // Service implementation
 * }
 * </pre>
 */
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE})
public @interface Service {
  /**
   * The entity type this service handles (e.g., Entity.TABLE, Entity.DATABASE).
   *
   * <p>This is used to register the service in the ServiceRegistry so resources can look it up by
   * entity type.
   *
   * @return The entity type string
   */
  String entityType();

  /**
   * Order of initialization (lower numbers initialize first).
   *
   * <p>This can be used if services have dependencies on each other and need specific
   * initialization order.
   *
   * @return Initialization order (default: 10)
   */
  int order() default 10;
}
