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

package org.openmetadata.service.secrets;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.util.ReflectionUtil;

public final class SecretsUtil {

  private SecretsUtil() {
    /* Final Class */
  }

  /** Returns an error message when it is related to an Unrecognized field */
  public static String buildExceptionMessageUnrecognizedField(
      String message, String defaultMessage, String exceptionMessage, String type) {
    if (exceptionMessage != null && exceptionMessage.contains("Unrecognized field")) {
      Pattern pattern = Pattern.compile("Unrecognized field \"(.*?)\"");
      Matcher matcher = pattern.matcher(exceptionMessage);
      if (matcher.find()) {
        String fieldValue = matcher.group(1);
        return String.format(message, type, fieldValue);
      }
      return String.format(defaultMessage, type);
    }
    return exceptionMessage;
  }

  public static String buildExceptionMessageConnection(
      String exceptionMessage,
      String type,
      String firstAction,
      String secondAction,
      boolean isFirstAction) {
    return buildExceptionMessageUnrecognizedField(
        "Failed to "
            + (isFirstAction ? firstAction : secondAction)
            + " '%s' connection stored in DB due to an unrecognized field: '%s'",
        "Failed to "
            + (isFirstAction ? firstAction : secondAction)
            + " '%s' connection stored in DB due to malformed connection object.",
        exceptionMessage,
        type);
  }

  public static String buildExceptionMessageConnection(
      String exceptionMessage, String type, boolean encrypt) {
    return buildExceptionMessageConnection(exceptionMessage, type, "encrypt", "decrypt", encrypt);
  }

  public static String buildExceptionMessageConnectionMask(
      String exceptionMessage, String type, boolean mask) {
    return buildExceptionMessageConnection(exceptionMessage, type, "mask", "unmask", mask);
  }

  public static Object convert(
      Object connectionConfig,
      String connectionType,
      String connectionName,
      ServiceType serviceType) {
    try {
      Class<?> clazz = ReflectionUtil.createConnectionConfigClass(connectionType, serviceType);
      return ClassConverterFactory.getConverter(clazz).convert(connectionConfig);
    } catch (Exception e) {
      // If we have the name we are trying to encrypt a connection
      String message = e.getMessage();
      if (connectionName != null) {
        throw new InvalidServiceConnectionException(
            String.format(
                "Failed to convert [%s] to type [%s]. Review the connection.\n%s",
                connectionName, connectionType, message),
            e);
      }
      // If we don't have the name, we are decrypting from the db
      throw new InvalidServiceConnectionException(
          String.format(
              "Failed to load the connection of type [%s]. Did migrations run properly?\n%s",
              connectionType, message),
          e);
    }
  }
}
