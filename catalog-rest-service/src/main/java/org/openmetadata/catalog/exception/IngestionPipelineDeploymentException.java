/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.exception;

import javax.ws.rs.core.Response;

public class IngestionPipelineDeploymentException extends WebServiceException {

    private static final String BY_NAME_MESSAGE = "Failed to deploy pipeline [%s] due to [%s].";

    public IngestionPipelineDeploymentException(String message) {
        super(Response.Status.BAD_REQUEST, message);
    }

    private IngestionPipelineDeploymentException(Response.Status status, String message) {
        super(status, message);
    }

    public static IngestionPipelineDeploymentException byMessage(String name, String errorMessage,
                                                                 Response.Status status) {
        return new IngestionPipelineDeploymentException(status, buildMessageByName(name, errorMessage));
    }

    public static IngestionPipelineDeploymentException byMessage(String name, String errorMessage) {
        return new IngestionPipelineDeploymentException(Response.Status.BAD_REQUEST, buildMessageByName(name,
                errorMessage));
    }

    private static String buildMessageByName(String name, String errorMessage) {
        return String.format(BY_NAME_MESSAGE, name, errorMessage);
    }

}
