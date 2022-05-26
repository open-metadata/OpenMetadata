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

import io.swagger.client.ApiClient;
import io.swagger.client.api.CatalogApi;
import io.swagger.client.model.CatalogVersion;
import io.swagger.client.model.OpenMetadataServerConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.util.Properties;
import java.util.regex.Pattern;
public class OpenMetadata {
    private static final Logger LOG = LoggerFactory.getLogger(OpenMetadata.class);
    private static final CatalogVersion CATALOG_VERSION_CLIENT;

    static {
        CATALOG_VERSION_CLIENT = new CatalogVersion();
        try {
            InputStream fileInput = OpenMetadata.class.getResourceAsStream("/catalog/VERSION");
            Properties props = new Properties();
            props.load(fileInput);
            CATALOG_VERSION_CLIENT.setVersion(props.getProperty("version", "unknown"));
            CATALOG_VERSION_CLIENT.setRevision(props.getProperty("revision", "unknown"));

            String timestampAsString = props.getProperty("timestamp");
            Long timestamp = timestampAsString != null ? Long.valueOf(timestampAsString) : null;
            CATALOG_VERSION_CLIENT.setTimestamp(timestamp);
        } catch (Exception ie) {
            LOG.warn("Failed to read catalog version file");
        }
    }
    private ApiClient apiClient;
    private OpenMetadataServerConnection serverConfig;
    private String basePath;
    public OpenMetadata(OpenMetadataServerConnection config){
        serverConfig = config;
        apiClient = new ApiClient();
        //TODO: Custom interceptor for AUTH, currently this only works for NO-AUTH, can be used for local testing
        basePath = config.getHostPort()+ "/";
        apiClient.setBasePath(basePath);
        validateVersion();
    }

    public <T extends ApiClient.Api> T buildClient(Class<T> clientClass) {
        return apiClient.buildClient(clientClass);
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
    public String getVersionFromString(String input){
        if (input.contains("-")) {
            return input.split(Pattern.quote("-"))[0];
        } else {
            throw new IllegalArgumentException("Invalid Version Given :" + input);
        }
    }
    public String getServerVersion(){
        CatalogApi api = apiClient.buildClient(CatalogApi.class);
        CatalogVersion serverVersion = api.getCatalogVersion();
        return getVersionFromString(serverVersion.getVersion());
    }
    public String getClientVersion(){
        return getVersionFromString(CATALOG_VERSION_CLIENT.getVersion());
    }
}
