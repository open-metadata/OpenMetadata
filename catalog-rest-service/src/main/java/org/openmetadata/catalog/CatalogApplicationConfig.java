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

package org.openmetadata.catalog;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.health.conf.HealthConfiguration;
import org.openmetadata.catalog.events.EventHandlerConfiguration;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import io.dropwizard.Configuration;
import io.dropwizard.db.DataSourceFactory;
import io.federecio.dropwizard.swagger.SwaggerBundleConfiguration;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

public class CatalogApplicationConfig extends Configuration {
    @Valid
    @NotNull
    @JsonProperty("database")
    private DataSourceFactory dataSourceFactory;

    @JsonProperty("swagger")
    private SwaggerBundleConfiguration swaggerBundleConfig;

    @JsonProperty("authorizerConfiguration")
    private AuthorizerConfiguration authorizerConfiguration;

    @JsonProperty("authenticationConfiguration")
    private AuthenticationConfiguration authenticationConfiguration;

    @JsonProperty("elasticsearch")
    private ElasticSearchConfiguration elasticSearchConfiguration;

    @JsonProperty("eventHandlerConfiguration")
    private EventHandlerConfiguration eventHandlerConfiguration;

    public DataSourceFactory getDataSourceFactory() {
        return dataSourceFactory;
    }

    public SwaggerBundleConfiguration getSwaggerBundleConfig() {
        return swaggerBundleConfig;
    }

    public AuthorizerConfiguration getAuthorizerConfiguration() {
        return authorizerConfiguration;
    }

    public void setAuthorizerConfiguration(AuthorizerConfiguration authorizerConfiguration) {
        this.authorizerConfiguration = authorizerConfiguration;
    }

    public AuthenticationConfiguration getAuthenticationConfiguration() {
        return authenticationConfiguration;
    }

    public void setAuthenticationConfiguration(AuthenticationConfiguration authenticationConfiguration) {
        this.authenticationConfiguration = authenticationConfiguration;
    }

    public ElasticSearchConfiguration getElasticSearchConfiguration() {
        return elasticSearchConfiguration;
    }

    public void setElasticSearchConfiguration(ElasticSearchConfiguration elasticSearchConfiguration) {
        this.elasticSearchConfiguration = elasticSearchConfiguration;
    }

    public EventHandlerConfiguration getEventHandlerConfiguration() {
        return eventHandlerConfiguration;
    }
    public void setEventHandlerConfiguration(EventHandlerConfiguration eventHandlerConfiguration) {
        this.eventHandlerConfiguration = eventHandlerConfiguration;
    }

    @Valid
    @NotNull
    @JsonProperty("health")
    private HealthConfiguration healthConfiguration = new HealthConfiguration();

    public HealthConfiguration getHealthConfiguration() {
        return healthConfiguration;
    }

    public void setHealthConfiguration(final HealthConfiguration healthConfiguration) {
        this.healthConfiguration = healthConfiguration;
    }

    @Override
    public String toString() {
        return "catalogConfig{" +
                ", dataSourceFactory=" + dataSourceFactory +
                ", swaggerBundleConfig=" + swaggerBundleConfig +
                ", authorizerConfiguration=" + authorizerConfiguration +
                '}';
    }
}
