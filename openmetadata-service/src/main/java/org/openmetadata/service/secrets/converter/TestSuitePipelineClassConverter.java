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

import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.metadataIngestion.ServiceConnections;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.McpConnection;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.type.SearchConnection;
import org.openmetadata.schema.type.SecurityConnection;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Types each connection a test suite pipeline carries by its connection type, so the secrets
 * manager and the masker reach its secrets as they reach a service's. A connection that cannot be
 * typed is refused: left as a map, its secrets would be out of their reach.
 */
public class TestSuitePipelineClassConverter extends ClassConverter {
  private static final String CONFIG_FIELD = "config";
  private static final String CONNECTION_TYPE_FIELD = "type";
  private static final Pattern CONNECTION_TYPE = Pattern.compile("\\p{Alnum}+");

  /** The service connections a test suite may carry, as {@code serviceConnection.json} lists them. */
  private static final Map<ServiceType, Class<? extends ServiceConnectionEntityInterface>>
      CONNECTION_CLASSES =
          new EnumMap<>(
              Map.ofEntries(
                  Map.entry(ServiceType.API, ApiConnection.class),
                  Map.entry(ServiceType.DASHBOARD, DashboardConnection.class),
                  Map.entry(ServiceType.DATABASE, DatabaseConnection.class),
                  Map.entry(ServiceType.DRIVE, DriveConnection.class),
                  Map.entry(ServiceType.MCP, McpConnection.class),
                  Map.entry(ServiceType.MESSAGING, MessagingConnection.class),
                  Map.entry(ServiceType.METADATA, MetadataConnection.class),
                  Map.entry(ServiceType.ML_MODEL, MlModelConnection.class),
                  Map.entry(ServiceType.PIPELINE, PipelineConnection.class),
                  Map.entry(ServiceType.SEARCH, SearchConnection.class),
                  Map.entry(ServiceType.SECURITY, SecurityConnection.class),
                  Map.entry(ServiceType.STORAGE, StorageConnection.class)));

  private record ConnectionClasses(
      Class<? extends ServiceConnectionEntityInterface> connection, Class<?> config) {}

  public TestSuitePipelineClassConverter() {
    super(TestSuitePipeline.class);
  }

  @Override
  public Object convert(Object object) {
    TestSuitePipeline testSuitePipeline = readTestSuitePipeline(object);
    if (testSuitePipeline.getServiceConnections() != null) {
      testSuitePipeline
          .getServiceConnections()
          .forEach(TestSuitePipelineClassConverter::typeConnection);
    }
    return testSuitePipeline;
  }

  /** A binding failure can quote the value it rejected, so only the field and rule are named. */
  private static TestSuitePipeline readTestSuitePipeline(Object object) {
    try {
      return JsonUtils.convertValue(object, TestSuitePipeline.class);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(
          JsonUtils.describeBindingFailure(e).orElse("it could not be converted"), e);
    }
  }

  private static void typeConnection(ServiceConnections serviceConnections) {
    if (serviceConnections.getServiceConnection() != null) {
      serviceConnections.setServiceConnection(
          typed(serviceConnections.getServiceName(), serviceConnections.getServiceConnection()));
    }
  }

  private static ServiceConnectionEntityInterface typed(
      final String serviceName, final Object connection) {
    final String connectionType = connectionType(connection);
    final ConnectionClasses classes = requireConnectionClasses(serviceName, connectionType);
    return convertConnection(serviceName, connectionType, connection, classes);
  }

  private static ConnectionClasses requireConnectionClasses(
      final String serviceName, final String connectionType) {
    return classesFor(connectionType)
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    String.format(
                        "Connection of service [%s] has no known connection type", serviceName)));
  }

  private static ServiceConnectionEntityInterface convertConnection(
      final String serviceName,
      final String connectionType,
      final Object connection,
      final ConnectionClasses classes) {
    try {
      final ServiceConnectionEntityInterface typedConnection =
          JsonUtils.convertValue(connection, classes.connection());
      typedConnection.setConfig(
          ClassConverterFactory.getConverter(classes.config())
              .convert(typedConnection.getConfig()));
      return typedConnection;
    } catch (RuntimeException e) {
      throw new IllegalArgumentException(
          String.format(
              "Connection of service [%s] does not match the %s connection schema: %s",
              serviceName,
              connectionType,
              JsonUtils.describeBindingFailure(e).orElse("it could not be converted")),
          e);
    }
  }

  /** {@link #readTestSuitePipeline} leaves every connection as the map it was sent as. */
  private static String connectionType(Object connection) {
    Object config = connection instanceof Map<?, ?> map ? map.get(CONFIG_FIELD) : null;
    Object connectionType =
        config instanceof Map<?, ?> configMap ? configMap.get(CONNECTION_TYPE_FIELD) : null;
    return connectionType instanceof String type ? type : null;
  }

  private static Optional<ConnectionClasses> classesFor(String connectionType) {
    return connectionType == null || !CONNECTION_TYPE.matcher(connectionType).matches()
        ? Optional.empty()
        : CONNECTION_CLASSES.entrySet().stream()
            .flatMap(
                kind ->
                    configClass(connectionType, kind.getKey())
                        .map(config -> new ConnectionClasses(kind.getValue(), config))
                        .stream())
            .findFirst();
  }

  /** A connection type names a config class in exactly one service kind's package. */
  private static Optional<Class<?>> configClass(String connectionType, ServiceType serviceType) {
    try {
      return Optional.of(ReflectionUtil.createConnectionConfigClass(connectionType, serviceType));
    } catch (ClassNotFoundException e) {
      return Optional.empty();
    }
  }
}
