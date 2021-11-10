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

package org.openmetadata.catalog.ingestion;

import javax.validation.constraints.NotEmpty;

public class AirflowConfiguration {

    @NotEmpty
    private String apiEndpoint;

    @NotEmpty
    private String username;

    @NotEmpty
    private String password;

    private Integer timeout = 30;

    private String metadataApiEndpoint;

    private String authProvider;

    private String secretKey = "";

    public String getApiEndpoint() {
        return apiEndpoint;
    }

    public void setApiEndpoint(String apiEndpoint) {
        this.apiEndpoint = apiEndpoint;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Integer getTimeout() {
        return timeout;
    }

    public void setTimeout(Integer timeout) {
        this.timeout = timeout;
    }

    public String getMetadataApiEndpoint() {
        return metadataApiEndpoint;
    }

    public String getAuthProvider() {
        return authProvider;
    }

    public String getSecretKey() {
        return secretKey;
    }

    @Override
    public String toString() {
        return "AirflowConfiguration{" +
                "apiEndpoint='" + apiEndpoint + '\'' +
                ", username='" + username + '\'' +
                ", password='" + password + '\'' +
                '}';
    }
}

