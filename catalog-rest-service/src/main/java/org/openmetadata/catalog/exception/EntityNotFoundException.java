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

package org.openmetadata.catalog.exception;


import javax.ws.rs.core.Response;

public class EntityNotFoundException extends WebServiceException {
  private static final String BY_ID_MESSAGE = "Entity with id [%s] not found.";
  private static final String BY_NAME_MESSAGE = "Entity with name [%s] not found.";
  private static final String BY_FILTER_MESSAGE = "Entity not found for query params [%s].";
  private static final String BY_VERSION_MESSAGE = "Entity with id [%s] and version [%s] not found.";
  private static final String BY_PARSER_SCHEMA_MESSAGE = "Parser schema not found for entity with id [%s].";

  public EntityNotFoundException(String message) {
    super(Response.Status.NOT_FOUND, message);
  }

  private EntityNotFoundException(String message, Throwable cause) {
    super(Response.Status.NOT_FOUND, message, cause);
  }

  public static EntityNotFoundException byId(String id) {
    return new EntityNotFoundException(buildMessageByID(id));
  }

  public static EntityNotFoundException byId(String id, Throwable cause) {
    return new EntityNotFoundException(buildMessageByID(id), cause);
  }

  public static EntityNotFoundException byMessage(String msg) {
    return new EntityNotFoundException(msg);
  }

  public static EntityNotFoundException byName(String name) {
    return new EntityNotFoundException(buildMessageByName(name));
  }

  public static EntityNotFoundException byName(String name, Throwable cause) {
    return new EntityNotFoundException(buildMessageByName(name), cause);
  }

  public static EntityNotFoundException byFilter(String parameter) {
    return new EntityNotFoundException(buildMessageByFilter(parameter));
  }

  public static EntityNotFoundException byFilter(String parameter, Throwable cause) {
    return new EntityNotFoundException(buildMessageByFilter(parameter), cause);
  }

  public static EntityNotFoundException byVersion(String id, String version) {
    return new EntityNotFoundException(buildMessageByVersion(id, version));
  }

  public static EntityNotFoundException byVersion(String id, String version, Throwable cause) {
    return new EntityNotFoundException(buildMessageByVersion(id, version), cause);
  }

  public static EntityNotFoundException byParserSchema(String id) {
    return new EntityNotFoundException(buildMessageByParserSchema(id));
  }

  public static EntityNotFoundException byParserSchema(String id, Throwable cause) {
    return new EntityNotFoundException(buildMessageByParserSchema(id), cause);
  }

  private static String buildMessageByID(String id) {
    return String.format(BY_ID_MESSAGE, id);
  }

  private static String buildMessageByName(String name) {
    return String.format(BY_NAME_MESSAGE, name);
  }

  private static String buildMessageByFilter(String parameter) {
    return String.format(BY_FILTER_MESSAGE, parameter);
  }

  private static String buildMessageByVersion(String id, String version) {
    return String.format(BY_VERSION_MESSAGE, id, version);
  }

  private static String buildMessageByParserSchema(String id) {
    return String.format(BY_PARSER_SCHEMA_MESSAGE, id);
  }
}
