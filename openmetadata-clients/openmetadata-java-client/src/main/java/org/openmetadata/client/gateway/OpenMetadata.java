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
import feign.Feign;
import feign.form.FormEncoder;
import feign.jackson.JacksonDecoder;
import feign.jackson.JacksonEncoder;
import feign.okhttp.OkHttpClient;
import feign.slf4j.Slf4jLogger;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.client.ApiClient;
import org.openmetadata.client.api.SystemApi;
import org.openmetadata.client.interceptors.CustomRequestInterceptor;
import org.openmetadata.client.security.factory.AuthenticationProviderFactory;
import org.openmetadata.schema.api.OpenMetadataServerVersion;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.utils.VersionUtils;

@Slf4j
public class OpenMetadata {
  private static final OpenMetadataServerVersion OPENMETADATA_VERSION_CLIENT;

  static {
    OPENMETADATA_VERSION_CLIENT = VersionUtils.getOpenMetadataServerVersion("/catalog/VERSION");
  }

  private ApiClient apiClient;
  private static final String REQUEST_INTERCEPTOR_KEY = "custom";

  public OpenMetadata(OpenMetadataConnection config) {
    initClient(config);
    validateVersion();
  }

  public OpenMetadata(OpenMetadataConnection config, boolean validateVersion) {
    initClient(config);
    if (validateVersion) validateVersion();
  }

  public void initClient(OpenMetadataConnection config) {
    apiClient = new ApiClient();
    Feign.Builder builder =
        Feign.builder()
            .encoder(new FormEncoder(new JacksonEncoder(apiClient.getObjectMapper())))
            .decoder(new JacksonDecoder(apiClient.getObjectMapper()))
            .logger(new Slf4jLogger())
            .client(new OkHttpClient());
    apiClient.setFeignBuilder(builder);
    AuthenticationProviderFactory factory = new AuthenticationProviderFactory();
    apiClient.addAuthorization("oauth", factory.getAuthProvider(config));
    String basePath = config.getHostPort() + "/";
    apiClient.setBasePath(basePath);
    apiClient.getObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
  }

  public <T extends ApiClient.Api> T buildClient(Class<T> clientClass) {
    return apiClient.buildClient(clientClass);
  }

  public <T extends ApiClient.Api, K> T buildClient(Class<T> clientClass, Class<K> requestClass) {
    updateRequestType(requestClass);
    return apiClient.buildClient(clientClass);
  }

  public <K> void updateRequestType(Class<K> requestClass) {
    apiClient.getApiAuthorizations().remove(REQUEST_INTERCEPTOR_KEY);
    CustomRequestInterceptor<K> newInterceptor =
        new CustomRequestInterceptor<>(apiClient.getObjectMapper(), requestClass);
    apiClient.addAuthorization(REQUEST_INTERCEPTOR_KEY, newInterceptor);
  }

  public void validateVersion() {
    String[] clientVersion = getClientVersion();
    String[] serverVersion = getServerVersion();
    // MAJOR MINOR REVISION
    if (serverVersion[0].equals(clientVersion[0])
        && serverVersion[1].equals(clientVersion[1])
        && serverVersion[2].equals(clientVersion[2])) {
      LOG.debug("OpenMetaData Client Initialized successfully.");
    } else {
      LOG.error(
          "OpenMetaData Client Failed to be Initialized successfully. Version mismatch between CLient and Server issue");
    }
  }

  public String[] getServerVersion() {
    SystemApi api = apiClient.buildClient(SystemApi.class);
    org.openmetadata.client.model.OpenMetadataServerVersion serverVersion = api.getCatalogVersion();
    return VersionUtils.getVersionFromString(serverVersion.getVersion());
  }

  public String[] getClientVersion() {
    return VersionUtils.getVersionFromString(OPENMETADATA_VERSION_CLIENT.getVersion());
  }
}
