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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.metadataIngestion.ServiceConnections;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Converter class to get a `TestSuitePipeline` object.
 *
 * <p>A logical test suite can carry the connections of the services it tests. Each one is a {@code
 * oneOf} over every service's connection, so its config class is resolved from the config's {@code
 * type}. Connection type names are unique across service types, and every service's connection
 * wraps nothing but that config, so the database wrapper the test suite workflow reads them as fits
 * them all. A config whose {@code type} is missing (it is optional, with a default) or unknown is
 * left as it is: failing here would also fail every read of the stored pipeline.
 */
public class TestSuitePipelineClassConverter extends ClassConverter {

  private static final String CONNECTION_TYPE = "type";

  public TestSuitePipelineClassConverter() {
    super(TestSuitePipeline.class);
  }

  @Override
  public Object convert(Object object) {
    TestSuitePipeline testSuitePipeline =
        (TestSuitePipeline) JsonUtils.convertValue(object, this.clazz);
    listOrEmpty(testSuitePipeline.getServiceConnections())
        .forEach(TestSuitePipelineClassConverter::convertServiceConnection);
    return testSuitePipeline;
  }

  private static void convertServiceConnection(ServiceConnections serviceConnections) {
    DatabaseConnection connection =
        JsonUtils.convertValue(serviceConnections.getServiceConnection(), DatabaseConnection.class);
    if (connection != null && connection.getConfig() instanceof Map<?, ?> config) {
      connection.setConfig(convertConfig(config));
    }
    serviceConnections.setServiceConnection(connection);
  }

  private static Object convertConfig(Map<?, ?> config) {
    return Optional.ofNullable(config.get(CONNECTION_TYPE))
        .flatMap(connectionType -> findConnectionConfigClass(String.valueOf(connectionType)))
        .map(configClass -> ClassConverterFactory.getConverter(configClass).convert(config))
        .orElse(config);
  }

  private static Optional<Class<?>> findConnectionConfigClass(String connectionType) {
    return Arrays.stream(ServiceType.values())
        .map(serviceType -> findConnectionConfigClass(connectionType, serviceType))
        .flatMap(Optional::stream)
        .findFirst();
  }

  private static Optional<Class<?>> findConnectionConfigClass(
      String connectionType, ServiceType serviceType) {
    try {
      return Optional.of(ReflectionUtil.createConnectionConfigClass(connectionType, serviceType));
    } catch (ClassNotFoundException e) {
      return Optional.empty();
    }
  }
}
