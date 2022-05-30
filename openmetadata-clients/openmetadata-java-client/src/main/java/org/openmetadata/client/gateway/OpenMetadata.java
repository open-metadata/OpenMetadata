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

package org.openmetadata.client.gateway;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.client.ApiClient;
import io.swagger.client.api.CatalogApi;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.api.CatalogVersion;
import org.openmetadata.client.interceptors.CustomRequestInterceptor;
import org.openmetadata.client.security.factory.AuthenticationProviderFactory;
import org.openmetadata.core.util.VersionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class OpenMetadata {
    private static final Logger LOG = LoggerFactory.getLogger(OpenMetadata.class);
    private static final CatalogVersion CATALOG_VERSION_CLIENT;

    static {
        CATALOG_VERSION_CLIENT = VersionUtils.getCatalogVersion("/catalog/VERSION");
    }
    private ApiClient apiClient;
    private OpenMetadataServerConnection serverConfig;
    private String basePath;
    private final String requestInterceptorKey = "custom";
    public OpenMetadata(OpenMetadataServerConnection config){
        serverConfig = config;
        apiClient = new ApiClient();
        AuthenticationProviderFactory factory = new AuthenticationProviderFactory();
        apiClient.addAuthorization("oauth" , factory.getAuthProvider(config));
        basePath = config.getHostPort()+ "/";
        apiClient.setBasePath(basePath);
        apiClient.getObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
        validateVersion();
    }

    public <T extends ApiClient.Api> T buildClient(Class<T> clientClass) {
        return apiClient.buildClient(clientClass);
    }

    public <T extends ApiClient.Api, K> T buildClient(Class<T> clientClass, Class<K> requestClass) {
        updateRequestType(requestClass);
        return apiClient.buildClient(clientClass);
    }

    public <K> void updateRequestType(Class<K> requestClass) {
        if (apiClient.getApiAuthorizations().containsKey(requestInterceptorKey)) {
            apiClient.getApiAuthorizations().remove(requestInterceptorKey);
        }
        CustomRequestInterceptor<K> newInterceptor = new CustomRequestInterceptor(apiClient.getObjectMapper(), requestClass);
        apiClient.addAuthorization(requestInterceptorKey, newInterceptor);
        return;
    }

    public void validateVersion(){
        String clientVersion = getClientVersion();
        String serverVersion = getServerVersion();
        if(serverVersion.equals(clientVersion)){
            LOG.debug("OpenMetaData Client Initialized successfully.");
        }else{
            LOG.error("OpenMetaData Client Failed to be Initialized successfully. Version mismatch between CLient and Server issue");
        }
    }

    public String getServerVersion(){
        CatalogApi api = apiClient.buildClient(CatalogApi.class);
        io.swagger.client.model.CatalogVersion serverVersion = api.getCatalogVersion();
        return VersionUtils.getVersionFromString(serverVersion.getVersion());
    }
    public String getClientVersion(){
        return VersionUtils.getVersionFromString(CATALOG_VERSION_CLIENT.getVersion());
    }
}
