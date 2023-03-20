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
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

public class SamlSettingsHolder {
  private static SamlSettingsHolder INSTANCE;
  private Map<String, Object> samlData;
  private SettingsBuilder builder;
  private Saml2Settings saml2Settings;
  private String relayState;
  private JWTTokenConfiguration jwtTokenConfiguration;
  private long tokenValidity;

  private SamlSettingsHolder() {
    samlData = new HashMap<>();
    builder = new SettingsBuilder();
  }

  public static SamlSettingsHolder getInstance() {
    if (INSTANCE == null) INSTANCE = new SamlSettingsHolder();
    return INSTANCE;
  }

  public void initDefaultSettings(OpenMetadataApplicationConfig catalogApplicationConfig)
      throws IOException, KeyStoreException, CertificateException, NoSuchAlgorithmException {
    SamlSSOClientConfig samlConfig = catalogApplicationConfig.getAuthenticationConfiguration().getSamlConfiguration();
    jwtTokenConfiguration = catalogApplicationConfig.getJwtTokenConfiguration();
    tokenValidity = samlConfig.getSp().getTokenValidity();
    if (samlData == null) {
      samlData = new HashMap<>();
    }
    if (builder == null) {
      builder = new SettingsBuilder();
    }
    // Service Provider Settings
    samlData.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, samlConfig.getSp().getEntityId());
    samlData.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, samlConfig.getSp().getAcs());
    samlData.put(
        SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST");
    samlData.put(SettingsBuilder.SP_SINGLE_LOGOUT_SERVICE_URL_PROPERTY_KEY, samlConfig.getSp().getLogoutUrl());
    samlData.put(
        SettingsBuilder.SP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(SettingsBuilder.SP_NAMEIDFORMAT_PROPERTY_KEY, samlConfig.getIdp().getNameId());
    samlData.put(SettingsBuilder.SP_X509CERT_PROPERTY_KEY, samlConfig.getSp().getSpX509Certificate());
    samlData.put(SettingsBuilder.SP_PRIVATEKEY_PROPERTY_KEY, JWTTokenGenerator.getInstance().getPrivateKey());
    relayState = samlConfig.getSp().getCallback();

    // IDP Provider Settings
    samlData.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, samlConfig.getIdp().getEntityId());
    samlData.put(SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY, samlConfig.getIdp().getSsoLoginUrl());
    samlData.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_URL_PROPERTY_KEY, samlConfig.getIdp().getSsoLogoutUrl());
    samlData.put(
        SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, samlConfig.getIdp().getIdpX509Certificate());
    samlData.put(SettingsBuilder.SECURITY_AUTHREQUEST_SIGNED, samlConfig.getIdp().getWantAuthRequestSigned());
    samlData.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_ENCRYPTED, samlConfig.getIdp().getWantAssertionEncrypted());
    samlData.put(SettingsBuilder.SECURITY_REQUESTED_AUTHNCONTEXTCOMPARISON, "exact");
    samlData.put(SettingsBuilder.SECURITY_SIGNATURE_ALGORITHM, "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
    samlData.put(SettingsBuilder.SECURITY_DIGEST_ALGORITHM, "http://www.w3.org/2001/04/xmlenc#sha256");
    if (samlConfig.getIdp().getWantAssertionEncrypted()) {
      if (!samlConfig.getSp().getKeyStoreFilePath().isEmpty()
          && !samlConfig.getSp().getKeyStoreFilePath().equals("")
          && !samlConfig.getSp().getKeyStorePassword().isEmpty()
          && !samlConfig.getSp().getKeyStorePassword().equals("")
          && !samlConfig.getSp().getKeyStoreAlias().isEmpty()
          && !samlConfig.getSp().getKeyStoreAlias().equals("")) {
        KeyStore keyStore = KeyStore.getInstance("JKS");
        keyStore.load(
            new FileInputStream(samlConfig.getSp().getKeyStoreFilePath()),
            samlConfig.getSp().getKeyStorePassword().toCharArray());
        samlData.put(SettingsBuilder.KEYSTORE_KEY, keyStore);
        samlData.put(SettingsBuilder.KEYSTORE_ALIAS, samlConfig.getSp().getKeyStoreAlias());
        samlData.put(SettingsBuilder.KEYSTORE_KEY_PASSWORD, samlConfig.getSp().getKeyStorePassword());
      } else
        throw new IllegalArgumentException(
            "KeyStoreFilePath, KeyStoreAlias and KeyStorePassword cannot be empty or null");
    }
    saml2Settings = builder.fromValues(samlData).build();
  }

  public Saml2Settings getSaml2Settings() {
    return saml2Settings;
  }

  public String getRelayState() {
    return relayState;
  }

  public JWTTokenConfiguration getJwtTokenConfiguration() {
    return jwtTokenConfiguration;
  }

  public long getTokenValidity() {
    return tokenValidity;
  }
}
