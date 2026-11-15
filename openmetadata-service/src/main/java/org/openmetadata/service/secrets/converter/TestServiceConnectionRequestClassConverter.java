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

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.util.ReflectionUtil;

/** Supplies the request's explicit connector type to the schema-derived wrapper. */
@Slf4j
public final class TestServiceConnectionRequestClassConverter extends ClassConverter {
  TestServiceConnectionRequestClassConverter(SchemaClassConverter engine) {
    super(TestServiceConnectionRequest.class, engine);
  }

  @Override
  public Object convert(Object object) {
    try {
      return super.convert(object);
    } catch (SchemaConversionException failure) {
      throw invalidConnection(object, failure);
    }
  }

  static Class<?> configClass(Map<String, Object> request) {
    Object service = request.get("serviceType");
    Object connection = request.get("connectionType");
    if (service == null || connection == null) {
      throw new SchemaConversionException("Fields 'serviceType' and 'connectionType' are required");
    }
    try {
      return ReflectionUtil.createConnectionConfigClass(
          connection.toString(), ServiceType.fromValue(service.toString()));
    } catch (ClassNotFoundException | IllegalArgumentException failure) {
      throw new SchemaConversionException(
          "The requested connection type is not supported", failure);
    }
  }

  static InvalidServiceConnectionException invalidConnection(
      Object object, SchemaConversionException cause) {
    Map<?, ?> request =
        object instanceof Map<?, ?> map ? map : JsonUtils.convertValue(object, Map.class);
    String detail = JsonUtils.describeBindingFailure(cause).orElse(cause.getMessage());
    String message =
        String.format("Invalid %s connection: %s", request.get("connectionType"), detail);
    Throwable root = ExceptionUtils.getRootCause(cause);
    LOG.warn(
        "Rejected test connection for service [{}]: {}; cause: {}",
        request.get("serviceName"),
        message,
        (root == null ? cause : root).getClass().getName());
    return new InvalidServiceConnectionException(message, cause);
  }
}
