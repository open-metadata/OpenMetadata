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

import java.util.List;
import org.openmetadata.schema.services.connections.database.SampleDataStorageConfig;

/**
 * Runs a connection's own converter, then types the {@code sampleDataStorageConfig} it carries.
 *
 * <p>Every database connection that can store sample data holds a typed {@link
 * SampleDataStorageConfig}, but its {@code config} is a {@code oneOf} and so a map, which hides the
 * S3 secret key from the masker and the secrets manager. {@link ClassConverterFactory} wraps each
 * such connection's converter in this one, so no connection converter has to repeat the step.
 */
final class SampleDataStorageConfigClassConverter extends ClassConverter {
  private static final String PROPERTY = "sampleDataStorageConfig";
  private static final List<Class<?>> CLASSES = List.of(SampleDataStorageConfig.class);

  private final ClassConverter connectionConverter;

  SampleDataStorageConfigClassConverter(Class<?> clazz, ClassConverter connectionConverter) {
    super(clazz);
    this.connectionConverter = connectionConverter;
  }

  @Override
  public Object convert(Object object) {
    Object connection = connectionConverter.convert(object);
    convertProperty(connection, PROPERTY, CLASSES);
    return connection;
  }

  static boolean holdsSampleDataStorageConfig(Class<?> clazz) {
    try {
      return clazz.getMethod("getSampleDataStorageConfig").getReturnType()
          == SampleDataStorageConfig.class;
    } catch (NoSuchMethodException e) {
      return false;
    }
  }
}
