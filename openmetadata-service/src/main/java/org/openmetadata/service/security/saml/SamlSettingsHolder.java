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

import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

public class SamlSettingsHolder {
  private static volatile Saml2Settings saml2Settings;
  private static final Object lock = new Object();
  private Map<String, Object> samlData;
  private SettingsBuilder builder;
  @Getter private String relayState;
  @Getter private long tokenValidity;
  @Getter private String domain;

  private SamlSettingsHolder() {
    samlData = new HashMap<>();
    builder = new SettingsBuilder();
  }

  public static SamlSettingsHolder getInstance() {
    return new SamlSettingsHolder();
  }

  public void initDefaultSettings(OpenMetadataApplicationConfig catalogApplicationConfig)
      throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException {
    SamlSSOClientConfig samlConfig =
        SecurityConfigurationManager.getInstance().getCurrentAuthConfig().getSamlConfiguration();
    tokenValidity = samlConfig.getSecurity().getTokenValidity();
    domain =
        SecurityConfigurationManager.getInstance().getCurrentAuthzConfig().getPrincipalDomain();
    if (samlData == null) {
      samlData = new HashMap<>();
    }
    if (builder == null) {
      builder = new SettingsBuilder();
    }
    // Lib Setting
    samlData.put(SettingsBuilder.DEBUG_PROPERTY_KEY, samlConfig.getDebugMode());

    // SP Info
    samlData.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, samlConfig.getSp().getEntityId());
    samlData.put(
        SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY,
        samlConfig.getSp().getAcs());
    samlData.put(
        SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST");
    samlData.put(
        SettingsBuilder.SP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(SettingsBuilder.SP_NAMEIDFORMAT_PROPERTY_KEY, samlConfig.getIdp().getNameId());
    relayState = samlConfig.getSp().getCallback();

    // Idp Info
    samlData.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, samlConfig.getIdp().getEntityId());
    samlData.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY,
        samlConfig.getIdp().getSsoLoginUrl());
    samlData.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(
        SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(
        SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, samlConfig.getIdp().getIdpX509Certificate());

    // Security Settings
    SamlSecurityConfig securityConfig = samlConfig.getSecurity();
    samlData.put(SettingsBuilder.STRICT_PROPERTY_KEY, securityConfig.getStrictMode());
    samlData.put(
        SettingsBuilder.SECURITY_NAMEID_ENCRYPTED, securityConfig.getSendEncryptedNameId());
    samlData.put(
        SettingsBuilder.SECURITY_AUTHREQUEST_SIGNED, securityConfig.getSendSignedAuthRequest());
    samlData.put(
        SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, securityConfig.getWantMessagesSigned());
    samlData.put(
        SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, securityConfig.getWantAssertionsSigned());
    samlData.put(SettingsBuilder.SECURITY_SIGN_METADATA, securityConfig.getSignSpMetadata());
    samlData.put(
        SettingsBuilder.SECURITY_WANT_ASSERTIONS_ENCRYPTED,
        securityConfig.getWantAssertionEncrypted());
    samlData.put(SettingsBuilder.SECURITY_WANT_NAMEID_ENCRYPTED, false);
    samlData.put(SettingsBuilder.SECURITY_REQUESTED_AUTHNCONTEXTCOMPARISON, "exact");
    samlData.put(
        SettingsBuilder.SECURITY_SIGNATURE_ALGORITHM,
        "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
    samlData.put(
        SettingsBuilder.SECURITY_DIGEST_ALGORITHM, "http://www.w3.org/2001/04/xmlenc#sha256");
    if (securityConfig.getSendSignedAuthRequest() || securityConfig.getWantAssertionEncrypted()) {
      if (!CommonUtil.nullOrEmpty(securityConfig.getKeyStoreFilePath())
          && !CommonUtil.nullOrEmpty(securityConfig.getKeyStorePassword())
          && !CommonUtil.nullOrEmpty(securityConfig.getKeyStoreAlias())) {
        KeyStore keyStore = KeyStore.getInstance("JKS");
        keyStore.load(
            new FileInputStream(securityConfig.getKeyStoreFilePath()),
            securityConfig.getKeyStorePassword().toCharArray());
        samlData.put(SettingsBuilder.KEYSTORE_KEY, keyStore);
        samlData.put(SettingsBuilder.KEYSTORE_ALIAS, securityConfig.getKeyStoreAlias());
        samlData.put(SettingsBuilder.KEYSTORE_KEY_PASSWORD, securityConfig.getKeyStorePassword());
      } else if (!CommonUtil.nullOrEmpty(samlConfig.getSp().getSpX509Certificate())
          || !CommonUtil.nullOrEmpty(samlConfig.getSp().getSpPrivateKey())) {
        samlData.put(
            SettingsBuilder.SP_PRIVATEKEY_PROPERTY_KEY, samlConfig.getSp().getSpPrivateKey());
        samlData.put(
            SettingsBuilder.SP_X509CERT_PROPERTY_KEY, samlConfig.getSp().getSpX509Certificate());
      } else {
        throw new IllegalArgumentException(
            "Either Specify (KeyStoreFilePath, KeyStoreAlias and KeyStorePassword) or (Sp X509 Certificate and Private Key) as one of both is mandatory.");
      }
    }
    samlData.put(SettingsBuilder.UNIQUE_ID_PREFIX_PROPERTY_KEY, "OPENMETADATA_");
    saml2Settings = builder.fromValues(samlData).build();
  }

  public static void setSaml2Settings(Saml2Settings settings) {
    synchronized (lock) {
      saml2Settings = settings;
    }
  }

  public static Saml2Settings getSaml2Settings() {
    synchronized (lock) {
      if (saml2Settings == null) {
        throw new IllegalStateException("SAML settings have not been initialized");
      }
      return saml2Settings;
    }
  }
}
