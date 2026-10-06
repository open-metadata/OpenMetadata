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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.util.ReflectionUtil;

/** Converter class to get an `TestServiceConnectionRequest` object. */
@Slf4j
public class TestServiceConnectionRequestClassConverter extends ClassConverter {

  private static final List<Class<?>> CONNECTION_CLASSES =
      List.of(
          DatabaseConnection.class,
          DashboardConnection.class,
          MessagingConnection.class,
          PipelineConnection.class,
          MlModelConnection.class,
          MetadataConnection.class,
          StorageConnection.class);

  public TestServiceConnectionRequestClassConverter() {
    super(TestServiceConnectionRequest.class);
  }

  @Override
  public Object convert(Object object) {
    TestServiceConnectionRequest testServiceConnectionRequest =
        (TestServiceConnectionRequest) JsonUtils.convertValue(object, this.clazz);
    try {
      convertConnection(testServiceConnectionRequest);
    } catch (ClassNotFoundException | RuntimeException e) {
      throw invalidConnection(testServiceConnectionRequest, e);
    }
    return testServiceConnectionRequest;
  }

  private void convertConnection(TestServiceConnectionRequest request)
      throws ClassNotFoundException {
    Class<?> configClass =
        ReflectionUtil.createConnectionConfigClass(
            request.getConnectionType(), request.getServiceType());
    tryToConvertOrFail(request.getConnection(), CONNECTION_CLASSES)
        .ifPresent(request::setConnection);
    ServiceConnectionEntityInterface connection =
        (ServiceConnectionEntityInterface) request.getConnection();
    connection.setConfig(
        ClassConverterFactory.getConverter(configClass).convert(connection.getConfig()));
  }

  /**
   * The connection is user input, so the message names the offending field and the constraint it
   * broke but never echoes a value, which may be a credential. The cause keeps the full detail for
   * the server log.
   */
  private static InvalidServiceConnectionException invalidConnection(
      TestServiceConnectionRequest request, Exception cause) {
    String message =
        String.format(
            "Invalid %s connection: %s",
            request.getConnectionType(),
            JsonUtils.describeBindingFailure(cause)
                .orElse("the connection could not be converted"));
    LOG.warn(
        "Rejected test connection for service [{}]: {}", request.getServiceName(), message, cause);
    return new InvalidServiceConnectionException(message, cause);
  }
}
