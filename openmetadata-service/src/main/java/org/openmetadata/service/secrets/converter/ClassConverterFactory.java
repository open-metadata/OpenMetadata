/*
 *  Copyright 2026 Collate
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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;

/** The legacy static boundary owns one retryable, lazily constructed conversion engine. */
public final class ClassConverterFactory {
  private static ClassConverterFactory instance;
  private final SchemaClassConverter engine;
  private final Map<Class<?>, ClassConverter> converters;
  private final Cache<Class<?>, ClassConverter> otherConverters =
      Caffeine.newBuilder().maximumSize(512).build();

  ClassConverterFactory(JsonSchemaRepository schemas) {
    engine = new SchemaClassConverter(schemas);
    Map<Class<?>, ClassConverter> defaults = new LinkedHashMap<>();
    schemas.javaClasses().forEach(type -> defaults.put(type, new ClassConverter(type, engine)));
    defaults.put(Workflow.class, new WorkflowClassConverter(engine));
    defaults.put(
        TestServiceConnectionRequest.class, new TestServiceConnectionRequestClassConverter(engine));
    converters = Map.copyOf(defaults);
  }

  private static synchronized ClassConverterFactory instance() {
    if (instance == null) {
      instance = new ClassConverterFactory(JsonSchemaRepository.getInstance());
    }
    return instance;
  }

  private static SchemaClassConverter engine() {
    return instance().engine;
  }

  public static ClassConverter getConverter(Class<?> clazz) {
    ClassConverterFactory factory = instance();
    ClassConverter converter = factory.converters.get(clazz);
    return converter == null
        ? factory.otherConverters.get(clazz, type -> new ClassConverter(type, factory.engine))
        : converter;
  }

  public static Map<Class<?>, ClassConverter> getConverterMap() {
    return instance().converters;
  }

  public static Object convertProperty(Class<?> owner, String property, Object value) {
    return engine().convertProperty(owner, property, value, false);
  }

  public static Object convertPropertyForRead(Class<?> owner, String property, Object value) {
    return engine().convertProperty(owner, property, value, true);
  }
}
