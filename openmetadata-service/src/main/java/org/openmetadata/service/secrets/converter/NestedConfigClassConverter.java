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

package org.openmetadata.service.secrets.converter;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter for connections whose only need is to re-type their {@code Object} properties -- the
 * ones a JSON Schema {@code oneOf} produces -- into the concrete classes that {@code oneOf} allows.
 *
 * <p>Prefer this over a bespoke converter class when the mapping is nothing but property name to
 * candidate classes; write a dedicated {@link ClassConverter} when the connection needs more.
 */
public class NestedConfigClassConverter extends ClassConverter {

  private final Map<String, List<Class<?>>> objectProperties;

  public NestedConfigClassConverter(Class<?> clazz, Map<String, List<Class<?>>> objectProperties) {
    super(clazz);
    this.objectProperties = Map.copyOf(objectProperties);
  }

  @Override
  public Object convert(Object object) {
    Object connection = JsonUtils.convertValue(object, this.clazz);
    objectProperties.forEach(
        (property, candidates) -> convertProperty(connection, property, candidates));
    return connection;
  }
}
