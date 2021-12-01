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


public final class BadRequestException extends WebServiceException {
  private static final String DEFAULT_MESSAGE = "Bad request.";
  private static final String PARAMETER_MISSING_MESSAGE = "Bad request. Param [%s] is missing or empty.";

  private BadRequestException(String message) {
    super(Response.Status.BAD_REQUEST, message);
  }

  private BadRequestException(String message, Throwable cause) {
    super(Response.Status.BAD_REQUEST, message, cause);
  }

  public static BadRequestException message(String message) {
    return new BadRequestException(message);
  }

  public static BadRequestException message(String message, Throwable cause) {
    return new BadRequestException(message, cause);
  }

  public static BadRequestException of() {
    return new BadRequestException(DEFAULT_MESSAGE);
  }

  public static BadRequestException of(Throwable cause) {
    return new BadRequestException(DEFAULT_MESSAGE, cause);
  }

  public static BadRequestException missingParameter(String parameterName) {
    return new BadRequestException(buildParameterMissingMessage(parameterName));
  }

  public static BadRequestException missingParameter(String parameterName, Throwable cause) {
    return new BadRequestException(buildParameterMissingMessage(parameterName), cause);
  }

  private static String buildParameterMissingMessage(String parameterName) {
    return String.format(PARAMETER_MISSING_MESSAGE, parameterName);
  }
}
