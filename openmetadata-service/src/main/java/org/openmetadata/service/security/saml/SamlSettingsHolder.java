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

package org.openmetadata.service.security.saml;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.TokenValidityResolver;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

@Slf4j
public class SamlSettingsHolder {
  private static final String HTTP_POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";
  private static final String HTTP_REDIRECT_BINDING =
      "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";

  /**
   * The settings for every configured Assertion Consumer Service, published in one write so a reload
   * never pairs a new primary with stale additional entries. Entries are keyed by configured ACS URL
   * and never by request input, so there is exactly one per configured URL.
   */
  private record SamlSettingsSnapshot(
      String primaryAcsUrl, Saml2Settings primary, Map<String, Saml2Settings> additionalByAcsUrl) {}

  private static volatile SamlSettingsSnapshot snapshot;

  private SamlSettingsHolder() {}

  public static SamlSettingsHolder getInstance() {
    return new SamlSettingsHolder();
  }

  public void initDefaultSettings(OpenMetadataApplicationConfig catalogApplicationConfig)
      throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException {
    initSettings(SecurityConfigurationManager.getCurrentAuthConfig().getSamlConfiguration());
  }

  /** Builds and publishes the settings for {@code samlConfig}'s primary and additional ACS URLs. */
  public static void initSettings(SamlSSOClientConfig samlConfig)
      throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException {
    Map<String, Object> values = settingsValues(samlConfig);
    Map<String, Saml2Settings> additionalByAcsUrl = new LinkedHashMap<>();
    listOrEmpty(samlConfig.getSp().getAdditionalAcsUrls()).stream()
        .filter(StringUtils::isNotBlank)
        .map(String::trim)
        .forEach(acsUrl -> additionalByAcsUrl.put(acsUrl, buildSettings(values, acsUrl)));
    String primaryAcsUrl = samlConfig.getSp().getAcs();
    snapshot =
        new SamlSettingsSnapshot(
            primaryAcsUrl,
            buildSettings(values, primaryAcsUrl),
            Collections.unmodifiableMap(additionalByAcsUrl));
  }

  public static Saml2Settings getSaml2Settings() {
    return requireSnapshot().primary();
  }

  /**
   * The additional ACS URL registered for {@code requestOrigin}, or {@code null} to keep the primary.
   * The origin is client-influenced, so it can only select an ACS the operator configured: an ACS is
   * where the identity provider POSTs a signed assertion.
   */
  public static String getAdditionalAcsUrlFor(String requestOrigin) {
    SamlSettingsSnapshot current = requireSnapshot();
    return SecurityUtil.sameOriginCallbackUrl(
        requestOrigin, current.primaryAcsUrl(), List.copyOf(current.additionalByAcsUrl().keySet()));
  }

  /**
   * The settings for a configured additional ACS URL, or the primary's for {@code null} or a URL no
   * longer configured, e.g. one recorded on a pending login before a reload.
   */
  public static Saml2Settings getSaml2SettingsForAcsUrl(String additionalAcsUrl) {
    SamlSettingsSnapshot current = requireSnapshot();
    return additionalAcsUrl == null
        ? current.primary()
        : current.additionalByAcsUrl().getOrDefault(additionalAcsUrl, current.primary());
  }

  public static List<String> getAdditionalAcsUrls() {
    return List.copyOf(requireSnapshot().additionalByAcsUrl().keySet());
  }

  private static SamlSettingsSnapshot requireSnapshot() {
    SamlSettingsSnapshot current = snapshot;
    if (current == null) {
      throw new IllegalStateException("SAML settings have not been initialized");
    }
    return current;
  }

  private static Saml2Settings buildSettings(Map<String, Object> values, String acsUrl) {
    Map<String, Object> acsValues = new HashMap<>(values);
    acsValues.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, acsUrl);
    return new SettingsBuilder().fromValues(acsValues).build();
  }

  private static Map<String, Object> settingsValues(SamlSSOClientConfig samlConfig)
      throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException {
    Map<String, Object> values = new HashMap<>();
    values.put(SettingsBuilder.DEBUG_PROPERTY_KEY, samlConfig.getDebugMode());
    putServiceProviderValues(values, samlConfig);
    putIdentityProviderValues(values, samlConfig);
    putSecurityValues(values, samlConfig.getSecurity());
    putSigningMaterial(values, samlConfig);
    values.put(SettingsBuilder.UNIQUE_ID_PREFIX_PROPERTY_KEY, "OPENMETADATA_");
    return values;
  }

  private static void putServiceProviderValues(
      Map<String, Object> values, SamlSSOClientConfig samlConfig) {
    values.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, samlConfig.getSp().getEntityId());
    values.put(
        SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_BINDING_PROPERTY_KEY, HTTP_POST_BINDING);
    values.put(
        SettingsBuilder.SP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY, HTTP_REDIRECT_BINDING);
    values.put(SettingsBuilder.SP_NAMEIDFORMAT_PROPERTY_KEY, samlConfig.getIdp().getNameId());
  }

  private static void putIdentityProviderValues(
      Map<String, Object> values, SamlSSOClientConfig samlConfig) {
    values.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, samlConfig.getIdp().getEntityId());
    values.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY,
        samlConfig.getIdp().getSsoLoginUrl());
    values.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_BINDING_PROPERTY_KEY, HTTP_REDIRECT_BINDING);
    values.put(
        SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY, HTTP_REDIRECT_BINDING);
    values.put(
        SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, samlConfig.getIdp().getIdpX509Certificate());
  }

  private static void putSecurityValues(
      Map<String, Object> values, SamlSecurityConfig securityConfig) {
    values.put(SettingsBuilder.STRICT_PROPERTY_KEY, securityConfig.getStrictMode());
    values.put(SettingsBuilder.SECURITY_NAMEID_ENCRYPTED, securityConfig.getSendEncryptedNameId());
    values.put(
        SettingsBuilder.SECURITY_AUTHREQUEST_SIGNED, securityConfig.getSendSignedAuthRequest());
    values.put(
        SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, securityConfig.getWantMessagesSigned());
    values.put(
        SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, securityConfig.getWantAssertionsSigned());
    values.put(SettingsBuilder.SECURITY_SIGN_METADATA, securityConfig.getSignSpMetadata());
    values.put(
        SettingsBuilder.SECURITY_WANT_ASSERTIONS_ENCRYPTED,
        securityConfig.getWantAssertionEncrypted());
    values.put(SettingsBuilder.SECURITY_WANT_NAMEID_ENCRYPTED, false);
    values.put(SettingsBuilder.SECURITY_REQUESTED_AUTHNCONTEXTCOMPARISON, "exact");
    values.put(
        SettingsBuilder.SECURITY_SIGNATURE_ALGORITHM,
        "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
    values.put(
        SettingsBuilder.SECURITY_DIGEST_ALGORITHM, "http://www.w3.org/2001/04/xmlenc#sha256");
  }

  private static void putSigningMaterial(Map<String, Object> values, SamlSSOClientConfig samlConfig)
      throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException {
    SamlSecurityConfig securityConfig = samlConfig.getSecurity();
    if (!securityConfig.getSendSignedAuthRequest() && !securityConfig.getWantAssertionEncrypted()) {
      return;
    }
    if (hasKeyStore(securityConfig)) {
      putKeyStore(values, securityConfig);
    } else if (!CommonUtil.nullOrEmpty(samlConfig.getSp().getSpX509Certificate())
        || !CommonUtil.nullOrEmpty(samlConfig.getSp().getSpPrivateKey())) {
      values.put(SettingsBuilder.SP_PRIVATEKEY_PROPERTY_KEY, samlConfig.getSp().getSpPrivateKey());
      values.put(
          SettingsBuilder.SP_X509CERT_PROPERTY_KEY, samlConfig.getSp().getSpX509Certificate());
    } else {
      throw new IllegalArgumentException(
          "Either Specify (KeyStoreFilePath, KeyStoreAlias and KeyStorePassword) or (Sp X509 Certificate and Private Key) as one of both is mandatory.");
    }
  }

  private static boolean hasKeyStore(SamlSecurityConfig securityConfig) {
    return !CommonUtil.nullOrEmpty(securityConfig.getKeyStoreFilePath())
        && !CommonUtil.nullOrEmpty(securityConfig.getKeyStorePassword())
        && !CommonUtil.nullOrEmpty(securityConfig.getKeyStoreAlias());
  }

  private static void putKeyStore(Map<String, Object> values, SamlSecurityConfig securityConfig)
      throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException {
    KeyStore keyStore = KeyStore.getInstance("JKS");
    keyStore.load(
        new FileInputStream(securityConfig.getKeyStoreFilePath()),
        securityConfig.getKeyStorePassword().toCharArray());
    values.put(SettingsBuilder.KEYSTORE_KEY, keyStore);
    values.put(SettingsBuilder.KEYSTORE_ALIAS, securityConfig.getKeyStoreAlias());
    values.put(SettingsBuilder.KEYSTORE_KEY_PASSWORD, securityConfig.getKeyStorePassword());
  }

  public long getTokenValidity() {
    try {
      AuthenticationConfiguration authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
      LOG.debug("Retrieved auth config: {}", authConfig != null ? "present" : "null");

      if (authConfig == null) {
        LOG.error("AuthenticationConfiguration is null in getTokenValidity()");
        return TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS;
      }

      SamlSSOClientConfig samlConfig = authConfig.getSamlConfiguration();
      LOG.debug("Retrieved SAML config: {}", samlConfig != null ? "present" : "null");

      if (samlConfig == null) {
        LOG.error("SamlConfiguration is null in getTokenValidity()");
        return TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS;
      }

      SamlSecurityConfig securityConfig = samlConfig.getSecurity();
      LOG.debug("Retrieved SAML security config: {}", securityConfig != null ? "present" : "null");

      if (securityConfig == null) {
        LOG.error(
            "SAML SecurityConfig is null in getTokenValidity() - this should not happen if config is in DB");
        return TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS;
      }

      Integer configuredTokenValidity = securityConfig.getTokenValidity();
      if (!TokenValidityResolver.isValid(configuredTokenValidity)) {
        LOG.warn(
            "SAML token validity must be positive; using the {} second default",
            TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS);
      }
      return TokenValidityResolver.resolveOrDefault(configuredTokenValidity);

    } catch (Exception e) {
      LOG.error("Error retrieving token validity dynamically", e);
      return TokenValidityResolver.DEFAULT_TOKEN_VALIDITY_SECONDS;
    }
  }

  public String getDomain() {
    try {
      AuthorizerConfiguration authzConfig = SecurityConfigurationManager.getCurrentAuthzConfig();
      LOG.debug("Retrieved authorizer config: {}", authzConfig != null ? "present" : "null");

      if (authzConfig == null) {
        LOG.error("AuthorizerConfiguration is null in getDomain()");
        return "openmetadata.org"; // Default fallback
      }

      String domain = authzConfig.getPrincipalDomain();
      LOG.debug("Retrieved principal domain: {}", domain);
      return domain != null ? domain : "openmetadata.org";

    } catch (Exception e) {
      LOG.error("Error retrieving domain dynamically", e);
      return "openmetadata.org"; // Default fallback
    }
  }
}
