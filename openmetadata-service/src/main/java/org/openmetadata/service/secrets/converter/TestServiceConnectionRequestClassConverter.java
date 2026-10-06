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
import org.apache.commons.lang3.exception.ExceptionUtils;
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
   * The connection is user input, and any value in it may be a credential, including a URI's
   * user-info or signed query string. The message therefore names only the offending field and the
   * constraint it broke. The cause stays on the exception but is not logged, because its messages
   * quote the rejected value.
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
        "Rejected test connection for service [{}]: {}; cause: {}",
        request.getServiceName(),
        message,
        ExceptionUtils.getRootCause(cause).getClass().getName());
    return new InvalidServiceConnectionException(message, cause);
  }
}
