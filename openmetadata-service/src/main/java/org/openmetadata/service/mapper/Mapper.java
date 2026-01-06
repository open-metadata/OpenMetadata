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

package org.openmetadata.service.mapper;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation for marking mapper classes that should be automatically discovered and registered.
 *
 * <p>Mappers annotated with @Mapper will be automatically discovered by MapperRegistry and
 * registered with their entity type. This follows the same pattern as @Repository and @Service
 * annotations for automatic discovery.
 *
 * <p>Example usage:
 *
 * <pre>
 * &#64;Mapper(entityType = Entity.TABLE)
 * public class TableMapper implements EntityMapper&lt;Table, CreateTable&gt; {
 *   // Mapper implementation
 * }
 * </pre>
 */
@Inherited
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE})
public @interface Mapper {
  /**
   * The entity type this mapper handles (e.g., Entity.TABLE, Entity.DATABASE).
   *
   * <p>This is used to register the mapper in the MapperRegistry so services can look it up by
   * entity type.
   *
   * @return The entity type string
   */
  String entityType();
}
