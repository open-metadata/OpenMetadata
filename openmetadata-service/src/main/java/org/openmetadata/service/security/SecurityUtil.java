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

package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.AuthLoginServlet.OIDC_CREDENTIAL_PROFILE;
import static org.openmetadata.service.security.JwtFilter.BOT_CLAIM;
import static org.openmetadata.service.security.JwtFilter.EMAIL_CLAIM_KEY;
import static org.openmetadata.service.security.JwtFilter.USERNAME_CLAIM_KEY;
import static org.pac4j.core.util.CommonHelper.assertNotNull;
import static org.pac4j.core.util.CommonHelper.isNotEmpty;

import com.auth0.jwt.interfaces.Claim;
import com.fasterxml.jackson.core.type.TypeReference;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMap.Builder;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jwt.JWT;
import com.nimbusds.oauth2.sdk.auth.ClientAuthentication;
import com.nimbusds.oauth2.sdk.auth.ClientAuthenticationMethod;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.ClientSecretPost;
import com.nimbusds.oauth2.sdk.auth.PrivateKeyJWT;
import com.nimbusds.oauth2.sdk.auth.Secret;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.nimbusds.oauth2.sdk.token.BearerAccessToken;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.security.PrivateKey;
import java.text.ParseException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.SecurityContext;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.util.JsonUtils;
import org.pac4j.core.context.HttpConstants;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.core.util.CommonHelper;
import org.pac4j.core.util.HttpUtils;
import org.pac4j.oidc.client.AzureAd2Client;
import org.pac4j.oidc.client.GoogleOidcClient;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.AzureAd2OidcConfiguration;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.config.PrivateKeyJWTClientAuthnMethodConfig;
import org.pac4j.oidc.credentials.OidcCredentials;
import org.pac4j.oidc.credentials.authenticator.OidcAuthenticator;

@Slf4j
public final class SecurityUtil {
  public static final String DEFAULT_PRINCIPAL_DOMAIN = "openmetadata.org";

  private static final Collection<ClientAuthenticationMethod> SUPPORTED_METHODS =
      Arrays.asList(
          ClientAuthenticationMethod.CLIENT_SECRET_POST,
          ClientAuthenticationMethod.CLIENT_SECRET_BASIC,
          ClientAuthenticationMethod.PRIVATE_KEY_JWT,
          ClientAuthenticationMethod.NONE);

  private SecurityUtil() {}

  public static String getUserName(SecurityContext securityContext) {
    Principal principal = securityContext.getUserPrincipal();
    return principal == null ? null : principal.getName().split("[/@]")[0];
  }

  public static Map<String, String> authHeaders(String username) {
    Builder<String, String> builder = ImmutableMap.builder();
    if (username != null) {
      builder.put(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER, username);
    }
    return builder.build();
  }

  public static String getPrincipalName(Map<String, String> authHeaders) {
    // Get username from the email address
    if (authHeaders == null) {
      return null;
    }
    String principal =
        authHeaders.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER);
    return principal == null ? null : principal.split("@")[0];
  }

  public static String getDomain(OpenMetadataApplicationConfig config) {
    String principalDomain = config.getAuthorizerConfiguration().getPrincipalDomain();
    return CommonUtil.nullOrEmpty(principalDomain) ? DEFAULT_PRINCIPAL_DOMAIN : principalDomain;
  }

  public static Invocation.Builder addHeaders(WebTarget target, Map<String, String> headers) {
    if (headers != null) {
      return target
          .request()
          .header(
              CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER,
              headers.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER));
    }
    return target.request();
  }

  public static OidcClient tryCreateOidcClient(OidcClientConfig clientConfig) {
    String id = clientConfig.getId();
    String secret = clientConfig.getSecret();
    if (CommonHelper.isNotBlank(id) && CommonHelper.isNotBlank(secret)) {
      OidcConfiguration configuration = new OidcConfiguration();
      configuration.setClientId(id);

      configuration.setResponseMode("query");

      // Add Secret
      if (CommonHelper.isNotBlank(secret)) {
        configuration.setSecret(secret);
      }

      // Response Type
      String responseType = clientConfig.getResponseType();
      if (CommonHelper.isNotBlank(responseType)) {
        configuration.setResponseType(responseType);
      }

      String scope = clientConfig.getScope();
      if (CommonHelper.isNotBlank(scope)) {
        configuration.setScope(scope);
      }

      String discoveryUri = clientConfig.getDiscoveryUri();
      if (CommonHelper.isNotBlank(discoveryUri)) {
        configuration.setDiscoveryURI(discoveryUri);
      }

      String useNonce = clientConfig.getUseNonce();
      if (CommonHelper.isNotBlank(useNonce)) {
        configuration.setUseNonce(Boolean.parseBoolean(useNonce));
      }

      String jwsAlgo = clientConfig.getPreferredJwsAlgorithm();
      if (CommonHelper.isNotBlank(jwsAlgo)) {
        configuration.setPreferredJwsAlgorithm(JWSAlgorithm.parse(jwsAlgo));
      }

      String maxClockSkew = clientConfig.getMaxClockSkew();
      if (CommonHelper.isNotBlank(maxClockSkew)) {
        configuration.setMaxClockSkew(Integer.parseInt(maxClockSkew));
      }

      String clientAuthenticationMethod = clientConfig.getClientAuthenticationMethod().value();
      if (CommonHelper.isNotBlank(clientAuthenticationMethod)) {
        configuration.setClientAuthenticationMethod(
            ClientAuthenticationMethod.parse(clientAuthenticationMethod));
      }

      // Disable PKCE
      configuration.setDisablePkce(clientConfig.getDisablePkce());

      // Add Custom Params
      if (clientConfig.getCustomParams() != null) {
        for (int j = 1; j <= 5; ++j) {
          if (clientConfig.getCustomParams().containsKey(String.format("customParamKey%d", j))) {
            configuration.addCustomParam(
                clientConfig.getCustomParams().get(String.format("customParamKey%d", j)),
                clientConfig.getCustomParams().get(String.format("customParamValue%d", j)));
          }
        }
      }

      String type = clientConfig.getType();
      OidcClient oidcClient;
      if ("azure".equalsIgnoreCase(type)) {
        AzureAd2OidcConfiguration azureAdConfiguration =
            new AzureAd2OidcConfiguration(configuration);
        String tenant = clientConfig.getTenant();
        if (CommonHelper.isNotBlank(tenant)) {
          azureAdConfiguration.setTenant(tenant);
        }

        oidcClient = new AzureAd2Client(azureAdConfiguration);
      } else if ("google".equalsIgnoreCase(type)) {
        oidcClient = new GoogleOidcClient(configuration);
        // Google needs it as param
        oidcClient.getConfiguration().getCustomParams().put("access_type", "offline");
      } else {
        oidcClient = new OidcClient(configuration);
      }

      oidcClient.setName(String.format("OMOidcClient%s", oidcClient.getName()));
      return oidcClient;
    }
    throw new IllegalArgumentException(
        "Client ID and Client Secret is required to create OidcClient");
  }

  public static ClientAuthentication getClientAuthentication(OidcConfiguration configuration) {
    ClientID clientID = new ClientID(configuration.getClientId());
    ClientAuthentication clientAuthenticationMechanism = null;
    if (configuration.getSecret() != null) {
      // check authentication methods
      List<ClientAuthenticationMethod> metadataMethods =
          configuration.findProviderMetadata().getTokenEndpointAuthMethods();

      ClientAuthenticationMethod preferredMethod = getPreferredAuthenticationMethod(configuration);

      final ClientAuthenticationMethod chosenMethod;
      if (isNotEmpty(metadataMethods)) {
        if (preferredMethod != null) {
          if (metadataMethods.contains(preferredMethod)) {
            chosenMethod = preferredMethod;
          } else {
            throw new TechnicalException(
                "Preferred authentication method ("
                    + preferredMethod
                    + ") not supported "
                    + "by provider according to provider metadata ("
                    + metadataMethods
                    + ").");
          }
        } else {
          chosenMethod = firstSupportedMethod(metadataMethods);
        }
      } else {
        chosenMethod =
            preferredMethod != null ? preferredMethod : ClientAuthenticationMethod.getDefault();
        LOG.info(
            "Provider metadata does not provide Token endpoint authentication methods. Using: {}",
            chosenMethod);
      }

      if (ClientAuthenticationMethod.CLIENT_SECRET_POST.equals(chosenMethod)) {
        Secret clientSecret = new Secret(configuration.getSecret());
        clientAuthenticationMechanism = new ClientSecretPost(clientID, clientSecret);
      } else if (ClientAuthenticationMethod.CLIENT_SECRET_BASIC.equals(chosenMethod)) {
        Secret clientSecret = new Secret(configuration.getSecret());
        clientAuthenticationMechanism = new ClientSecretBasic(clientID, clientSecret);
      } else if (ClientAuthenticationMethod.PRIVATE_KEY_JWT.equals(chosenMethod)) {
        PrivateKeyJWTClientAuthnMethodConfig privateKetJwtConfig =
            configuration.getPrivateKeyJWTClientAuthnMethodConfig();
        assertNotNull("privateKetJwtConfig", privateKetJwtConfig);
        JWSAlgorithm jwsAlgo = privateKetJwtConfig.getJwsAlgorithm();
        assertNotNull("privateKetJwtConfig.getJwsAlgorithm()", jwsAlgo);
        PrivateKey privateKey = privateKetJwtConfig.getPrivateKey();
        assertNotNull("privateKetJwtConfig.getPrivateKey()", privateKey);
        String keyID = privateKetJwtConfig.getKeyID();
        try {
          clientAuthenticationMechanism =
              new PrivateKeyJWT(
                  clientID,
                  configuration.findProviderMetadata().getTokenEndpointURI(),
                  jwsAlgo,
                  privateKey,
                  keyID,
                  null);
        } catch (final JOSEException e) {
          throw new TechnicalException(
              "Cannot instantiate private key JWT client authentication method", e);
        }
      }
    }

    return clientAuthenticationMechanism;
  }

  private static ClientAuthenticationMethod getPreferredAuthenticationMethod(
      OidcConfiguration config) {
    ClientAuthenticationMethod configurationMethod = config.getClientAuthenticationMethod();
    if (configurationMethod == null) {
      return null;
    }

    if (!SUPPORTED_METHODS.contains(configurationMethod)) {
      throw new TechnicalException(
          "Configured authentication method (" + configurationMethod + ") is not supported.");
    }

    return configurationMethod;
  }

  private static ClientAuthenticationMethod firstSupportedMethod(
      final List<ClientAuthenticationMethod> metadataMethods) {
    Optional<ClientAuthenticationMethod> firstSupported =
        metadataMethods.stream().filter(SUPPORTED_METHODS::contains).findFirst();
    if (firstSupported.isPresent()) {
      return firstSupported.get();
    } else {
      throw new TechnicalException(
          "None of the Token endpoint provider metadata authentication methods are supported: "
              + metadataMethods);
    }
  }

  @SneakyThrows
  public static void getErrorMessage(HttpServletResponse resp, Exception e) {
    resp.setContentType("text/html; charset=UTF-8");
    LOG.error("[Auth Callback Servlet] Failed in Auth Login : {}", e.getMessage());
    resp.getOutputStream()
        .println(
            String.format(
                "<p> [Auth Callback Servlet] Failed in Auth Login : %s </p>", e.getMessage()));
  }

  public static void sendRedirectWithToken(
      HttpServletResponse response,
      OidcCredentials credentials,
      String serverUrl,
      Map<String, String> claimsMapping,
      List<String> claimsOrder,
      String defaultDomain)
      throws ParseException, IOException {
    JWT jwt = credentials.getIdToken();
    Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(jwt.getJWTClaimsSet().getClaims());

    String userName = findUserNameFromClaims(claimsMapping, claimsOrder, claims);
    String email = findEmailFromClaims(claimsMapping, claimsOrder, claims, defaultDomain);

    String url =
        String.format(
            "%s/auth/callback?id_token=%s&email=%s&name=%s",
            serverUrl, credentials.getIdToken().getParsedString(), email, userName);
    response.sendRedirect(url);
  }

  public static boolean isCredentialsExpired(OidcCredentials credentials) throws ParseException {
    Date expiration = credentials.getIdToken().getJWTClaimsSet().getExpirationTime();
    return expiration != null && expiration.toInstant().isBefore(Instant.now().plusSeconds(30));
  }

  public static Optional<OidcCredentials> getUserCredentialsFromSession(
      HttpServletRequest request, OidcClient client) throws ParseException {
    OidcCredentials credentials =
        (OidcCredentials) request.getSession().getAttribute(OIDC_CREDENTIAL_PROFILE);
    if (credentials != null && credentials.getRefreshToken() != null) {
      removeOrRenewOidcCredentials(request, client, credentials);
      return Optional.of(credentials);
    } else {
      if (credentials == null) {
        LOG.error("No credentials found against session. ID: {}", request.getSession().getId());
      } else {
        LOG.error("No refresh token found against session. ID: {}", request.getSession().getId());
      }
    }
    return Optional.empty();
  }

  private static void removeOrRenewOidcCredentials(
      HttpServletRequest request, OidcClient client, OidcCredentials credentials) {
    LOG.debug("Expired credentials found, trying to renew.");
    if (client.getConfiguration() instanceof AzureAd2OidcConfiguration azureAd2OidcConfiguration) {
      refreshAccessTokenAzureAd2Token(azureAd2OidcConfiguration, credentials);
    } else {
      OidcAuthenticator authenticator = new OidcAuthenticator(client.getConfiguration(), client);
      authenticator.refresh(credentials);
    }
    request.getSession().setAttribute(OIDC_CREDENTIAL_PROFILE, credentials);
  }

  private static void refreshAccessTokenAzureAd2Token(
      AzureAd2OidcConfiguration azureConfig, OidcCredentials azureAdProfile) {
    HttpURLConnection connection = null;
    try {
      Map<String, String> headers = new HashMap<>();
      headers.put(
          HttpConstants.CONTENT_TYPE_HEADER, HttpConstants.APPLICATION_FORM_ENCODED_HEADER_VALUE);
      headers.put(HttpConstants.ACCEPT_HEADER, HttpConstants.APPLICATION_JSON);
      // get the token endpoint from discovery URI
      URL tokenEndpointURL = azureConfig.findProviderMetadata().getTokenEndpointURI().toURL();
      connection = HttpUtils.openPostConnection(tokenEndpointURL, headers);

      BufferedWriter out =
          new BufferedWriter(
              new OutputStreamWriter(connection.getOutputStream(), StandardCharsets.UTF_8));
      out.write(azureConfig.makeOauth2TokenRequest(azureAdProfile.getRefreshToken().getValue()));
      out.close();

      int responseCode = connection.getResponseCode();
      if (responseCode != 200) {
        throw new TechnicalException(
            "request for access token failed: " + HttpUtils.buildHttpErrorMessage(connection));
      }
      var body = HttpUtils.readBody(connection);
      Map<String, Object> res = JsonUtils.readValue(body, new TypeReference<>() {});
      azureAdProfile.setAccessToken(new BearerAccessToken((String) res.get("access_token")));
    } catch (final IOException e) {
      throw new TechnicalException(e);
    } finally {
      HttpUtils.closeConnection(connection);
    }
  }

  public static String findUserNameFromClaims(
      Map<String, String> jwtPrincipalClaimsMapping,
      List<String> jwtPrincipalClaimsOrder,
      Map<String, ?> claims) {
    if (!nullOrEmpty(jwtPrincipalClaimsMapping)) {
      // We have a mapping available so we will use that
      String usernameClaim = jwtPrincipalClaimsMapping.get(USERNAME_CLAIM_KEY);
      String userNameClaimValue = getClaimOrObject(claims.get(usernameClaim));
      if (!nullOrEmpty(userNameClaimValue)) {
        return userNameClaimValue;
      } else {
        throw new AuthenticationException("Invalid JWT token, 'username' claim is not present");
      }
    } else {
      String jwtClaim = getFirstMatchJwtClaim(jwtPrincipalClaimsOrder, claims);
      String userName;
      if (jwtClaim.contains("@")) {
        userName = jwtClaim.split("@")[0];
      } else {
        userName = jwtClaim;
      }
      return userName;
    }
  }

  public static String findEmailFromClaims(
      Map<String, String> jwtPrincipalClaimsMapping,
      List<String> jwtPrincipalClaimsOrder,
      Map<String, ?> claims,
      String defaulPrincipalClaim) {
    if (!nullOrEmpty(jwtPrincipalClaimsMapping)) {
      // We have a mapping available so we will use that
      String emailClaim = jwtPrincipalClaimsMapping.get(EMAIL_CLAIM_KEY);
      String emailClaimValue = getClaimOrObject(claims.get(emailClaim));
      if (!nullOrEmpty(emailClaimValue) && emailClaimValue.contains("@")) {
        return emailClaimValue;
      } else {
        throw new AuthenticationException(
            String.format(
                "Invalid JWT token, 'email' claim is not present or invalid : %s",
                emailClaimValue));
      }
    } else {
      String jwtClaim = getFirstMatchJwtClaim(jwtPrincipalClaimsOrder, claims);
      if (jwtClaim.contains("@")) {
        return jwtClaim;
      } else {
        return String.format("%s@%s", jwtClaim, defaulPrincipalClaim);
      }
    }
  }

  private static String getClaimOrObject(Object obj) {
    if (obj == null) {
      return "";
    }

    if (obj instanceof Claim c) {
      return c.asString();
    } else if (obj instanceof String s) {
      return s;
    }

    return StringUtils.EMPTY;
  }

  public static String getFirstMatchJwtClaim(
      List<String> jwtPrincipalClaimsOrder, Map<String, ?> claims) {
    return jwtPrincipalClaimsOrder.stream()
        .filter(claims::containsKey)
        .findFirst()
        .map(claims::get)
        .map(SecurityUtil::getClaimOrObject)
        .orElseThrow(
            () ->
                new AuthenticationException(
                    "Invalid JWT token, none of the following claims are present "
                        + jwtPrincipalClaimsOrder));
  }

  public static void validatePrincipalClaimsMapping(Map<String, String> mapping) {
    if (!nullOrEmpty(mapping)) {
      String username = mapping.get(USERNAME_CLAIM_KEY);
      String email = mapping.get(EMAIL_CLAIM_KEY);
      if (nullOrEmpty(username) || nullOrEmpty(email)) {
        throw new IllegalArgumentException(
            "Invalid JWT Principal Claims Mapping. Both username and email should be present");
      }
    }
    // If emtpy, jwtPrincipalClaims will be used so no need to validate
  }

  public static void validateDomainEnforcement(
      Map<String, String> jwtPrincipalClaimsMapping,
      List<String> jwtPrincipalClaimsOrder,
      Map<String, Claim> claims,
      String principalDomain,
      boolean enforcePrincipalDomain) {
    String domain = StringUtils.EMPTY;
    if (!nullOrEmpty(jwtPrincipalClaimsMapping)) {
      // We have a mapping available so we will use that
      String emailClaim = jwtPrincipalClaimsMapping.get(EMAIL_CLAIM_KEY);
      String emailClaimValue = getClaimOrObject(claims.get(emailClaim));
      if (!nullOrEmpty(emailClaimValue)) {
        if (emailClaimValue.contains("@")) {
          domain = emailClaimValue.split("@")[1];
        }
      } else {
        throw new AuthenticationException("Invalid JWT token, 'email' claim is not present");
      }
    } else {
      String jwtClaim = getFirstMatchJwtClaim(jwtPrincipalClaimsOrder, claims);
      if (jwtClaim.contains("@")) {
        domain = jwtClaim.split("@")[1];
      }
    }

    // Validate
    if (!isBot(claims) && (enforcePrincipalDomain && !domain.equals(principalDomain))) {
      throw new AuthenticationException(
          String.format(
              "Not Authorized! Email does not match the principal domain %s", principalDomain));
    }
  }

  public static boolean isBot(Map<String, Claim> claims) {
    return claims.containsKey(BOT_CLAIM) && Boolean.TRUE.equals(claims.get(BOT_CLAIM).asBoolean());
  }
}
