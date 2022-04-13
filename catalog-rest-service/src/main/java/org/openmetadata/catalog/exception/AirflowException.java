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

public class AirflowException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "Airflow Exception [%s] due to [%s].";

  public AirflowException(String message) {
    super(Response.Status.BAD_REQUEST, message);
  }

  private AirflowException(Response.Status status, String message) {
    super(status, message);
  }

  public static AirflowException byMessage(String name, String errorMessage, Response.Status status) {
    return new AirflowException(status, buildMessageByName(name, errorMessage));
  }

  public static AirflowException byMessage(String name, String errorMessage) {
    return new AirflowException(Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
