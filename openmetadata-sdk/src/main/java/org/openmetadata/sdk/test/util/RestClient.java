/*
 *  Copyright 2025 Collate
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
package org.openmetadata.sdk.test.util;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.glassfish.jersey.apache.connector.ApacheConnectorProvider;
import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.client.ClientProperties;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.auth.JwtAuthProvider;

/**
 * JAX-RS REST client for integration tests targeting endpoints that the main
 * {@link org.openmetadata.sdk.client.OpenMetadataClient} does not (yet) cover. Useful for raw
 * REST interactions — arbitrary paths, custom query params, PATCH diff requests, and the
 * {@code hardDelete=true&recursive=true} flavor of delete.
 *
 * <p>All requests are authenticated via the bearer token attached when the client is built.
 */
public class RestClient {

  private static final int CONNECT_TIMEOUT_MILLIS = (int) Duration.ofSeconds(10).toMillis();
  private static final int READ_TIMEOUT_MILLIS = (int) Duration.ofSeconds(60).toMillis();
  private static final Client SHARED_CLIENT;

  static {
    ClientConfig clientConfig =
        new ClientConfig()
            .connectorProvider(new ApacheConnectorProvider())
            .property(ClientProperties.CONNECT_TIMEOUT, CONNECT_TIMEOUT_MILLIS)
            .property(ClientProperties.READ_TIMEOUT, READ_TIMEOUT_MILLIS);
    SHARED_CLIENT = ClientBuilder.newBuilder().withConfig(clientConfig).build();
  }

  private final Client client;
  private final String baseUrl;
  private final Map<String, String> authHeaders;

  private RestClient(String baseUrl, Map<String, String> authHeaders) {
    this.baseUrl = baseUrl;
    this.authHeaders = authHeaders;
    this.client = SHARED_CLIENT;
  }

  public static RestClient admin() {
    String url = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();
    return new RestClient(url, Map.of("Authorization", "Bearer " + token));
  }

  public static RestClient forUser(String email, String[] roles) {
    String url = SdkClients.getServerUrl();
    String token = JwtAuthProvider.tokenFor(email.split("@")[0], email, roles, 3600);
    return new RestClient(url, Map.of("Authorization", "Bearer " + token));
  }

  public <T> T create(String path, Object request, Class<T> responseType)
      throws HttpResponseException {
    Response response =
        target(path).post(Entity.entity(JsonUtils.pojoToJson(request), MediaType.APPLICATION_JSON));
    return handleResponse(response, responseType);
  }

  public <T> T get(String path, Class<T> responseType) throws HttpResponseException {
    Response response = target(path).get();
    return handleResponse(response, responseType);
  }

  public <T> T getById(String path, UUID id, String fields, Class<T> responseType)
      throws HttpResponseException {
    WebTarget t = webTarget(path + "/" + id);
    if (fields != null && !fields.isEmpty()) {
      t = t.queryParam("fields", fields);
    }
    Response response = addHeaders(t).get();
    return handleResponse(response, responseType);
  }

  public <T> T update(String path, Object request, Class<T> responseType)
      throws HttpResponseException {
    Response response =
        target(path).put(Entity.entity(JsonUtils.pojoToJson(request), MediaType.APPLICATION_JSON));
    return handleResponse(response, responseType);
  }

  public <T> T patch(
      String path, UUID id, String originalJson, Object updated, Class<T> responseType)
      throws HttpResponseException {
    String updatedJson = JsonUtils.pojoToJson(updated);
    jakarta.json.JsonPatch patch =
        jakarta.json.Json.createDiff(
            jakarta.json.Json.createReader(new java.io.StringReader(originalJson)).readObject(),
            jakarta.json.Json.createReader(new java.io.StringReader(updatedJson)).readObject());

    Response response =
        addHeaders(webTarget(path + "/" + id))
            .method(
                "PATCH", Entity.entity(patch.toString(), MediaType.APPLICATION_JSON_PATCH_JSON));
    return handleResponse(response, responseType);
  }

  public void delete(String path, UUID id) throws HttpResponseException {
    Response response = target(path + "/" + id).delete();
    try {
      if (response.getStatus() >= 400) {
        throw new HttpResponseException(response.getStatus(), response.readEntity(String.class));
      }
    } finally {
      response.close();
    }
  }

  public void hardDelete(String path, UUID id) throws HttpResponseException {
    WebTarget t =
        webTarget(path + "/" + id).queryParam("hardDelete", true).queryParam("recursive", true);
    Response response = addHeaders(t).delete();
    try {
      if (response.getStatus() >= 400) {
        throw new HttpResponseException(response.getStatus(), response.readEntity(String.class));
      }
    } finally {
      response.close();
    }
  }

  public <T> T restore(String path, UUID id, Class<T> responseType) throws HttpResponseException {
    Response response =
        target(path + "/restore")
            .put(Entity.entity("{\"id\":\"" + id + "\"}", MediaType.APPLICATION_JSON));
    return handleResponse(response, responseType);
  }

  public Response rawGet(String path) {
    return target(path).get();
  }

  public Response rawPost(String path, Object body) {
    return target(path).post(Entity.entity(JsonUtils.pojoToJson(body), MediaType.APPLICATION_JSON));
  }

  public Response rawPut(String path, Object body) {
    return target(path).put(Entity.entity(JsonUtils.pojoToJson(body), MediaType.APPLICATION_JSON));
  }

  public Response rawDelete(String path) {
    return target(path).delete();
  }

  public WebTarget webTarget(String path) {
    String p = path.startsWith("/") ? path : "/" + path;
    // baseUrl already ends with /api, paths start with /v1/...
    return client.target(baseUrl + p);
  }

  private Invocation.Builder target(String path) {
    return addHeaders(webTarget(path));
  }

  private Invocation.Builder addHeaders(WebTarget target) {
    Invocation.Builder builder = target.request(MediaType.APPLICATION_JSON);
    for (Map.Entry<String, String> header : authHeaders.entrySet()) {
      builder = builder.header(header.getKey(), header.getValue());
    }
    return builder;
  }

  private <T> T handleResponse(Response response, Class<T> type) throws HttpResponseException {
    try (response) {
      if (response.getStatus() >= 400) {
        String body = response.readEntity(String.class);
        throw new HttpResponseException(response.getStatus(), body);
      }
      if (type == String.class) {
        return type.cast(response.readEntity(String.class));
      }
      String json = response.readEntity(String.class);
      return JsonUtils.readValue(json, type);
    }
  }
}
