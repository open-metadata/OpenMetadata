package org.openmetadata.client.interceptors;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.openmetadata.client.model.AccessTokenResponse;
import org.openmetadata.schema.security.client.Auth0SSOClientConfig;

public class Auth0AccessTokenRequestInterceptor implements RequestInterceptor {

  private final Auth0SSOClientConfig securityConfig;

  public Auth0AccessTokenRequestInterceptor(Auth0SSOClientConfig config) {
    securityConfig = config;
  }

  @Override
  public void apply(RequestTemplate requestTemplate) {
    String requestBody =
        "grant_type="
            + AccessTokenResponse.GrantType.CLIENT_CREDENTIALS
            + "&client_id="
            + securityConfig.getClientId()
            + "&client_secret="
            + securityConfig.getSecretKey()
            + "&audience=https://"
            + securityConfig.getDomain()
            + "/api/v2/";
    requestTemplate.body(requestBody);
  }
}
