package org.openmetadata.catalog.security.saml;

import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.security.jwt.JWTTokenConfiguration;

public class SamlSettingsHolder {
  private static SamlSettingsHolder INSTANCE;
  private Map<String, Object> samlData;
  private SettingsBuilder builder;
  private Saml2Settings saml2Settings;
  private String relayState;

  private JWTTokenConfiguration jwtTokenConfiguration;

  private SamlSettingsHolder() {
    samlData = new HashMap<>();
    builder = new SettingsBuilder();
  }

  public static SamlSettingsHolder getInstance() {
    if (INSTANCE == null) INSTANCE = new SamlSettingsHolder();

    return INSTANCE;
  }

  public void initDefaultSettings(CatalogApplicationConfig catalogApplicationConfig) {
    SamlSSOClientConfig samlConfig = catalogApplicationConfig.getSamlConfiguration();
    jwtTokenConfiguration = catalogApplicationConfig.getJwtTokenConfiguration();
    if (samlData == null) {
      samlData = new HashMap<>();
    }
    if (builder == null) {
      builder = new SettingsBuilder();
    }
    samlData.put(SettingsBuilder.STRICT_PROPERTY_KEY, false);
    samlData.put(SettingsBuilder.DEBUG_PROPERTY_KEY, false);

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
    samlData.put(SettingsBuilder.SP_NAMEIDFORMAT_PROPERTY_KEY, "urn:oasis:names:tc:SAML:2.0:nameid-format:transient");
    samlData.put(SettingsBuilder.SP_X509CERT_PROPERTY_KEY, samlConfig.getSp().getSpX509Certificate());
    samlData.put(SettingsBuilder.SP_PRIVATEKEY_PROPERTY_KEY, "");
    relayState = samlConfig.getSp().getCallback();

    // IDP Provider Settings
    samlData.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, samlConfig.getIdp().getEntityId());
    samlData.put(SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY, samlConfig.getIdp().getSsoLoginUrl());
    samlData.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_URL_PROPERTY_KEY, samlConfig.getIdp().getSsoLogoutUrl());
    samlData.put(SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_RESPONSE_URL_PROPERTY_KEY, null);
    samlData.put(
        SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY,
        "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
    samlData.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, samlConfig.getIdp().getIdpX509Certificate());
    samlData.put(SettingsBuilder.CERTFINGERPRINT_PROPERTY_KEY, null);
    samlData.put(SettingsBuilder.CERTFINGERPRINT_ALGORITHM_PROPERTY_KEY, null);
    // SAML Security Settings
    samlData.put(SettingsBuilder.SECURITY_NAMEID_ENCRYPTED, false);
    samlData.put(SettingsBuilder.SECURITY_AUTHREQUEST_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_LOGOUTREQUEST_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_LOGOUTRESPONSE_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_SIGN_METADATA, null);
    samlData.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_ENCRYPTED, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_NAMEID_ENCRYPTED, false);
    samlData.put(SettingsBuilder.SECURITY_REQUESTED_AUTHNCONTEXT, null);
    samlData.put(SettingsBuilder.SECURITY_REQUESTED_AUTHNCONTEXTCOMPARISON, "exact");
    samlData.put(SettingsBuilder.SECURITY_ALLOW_REPEAT_ATTRIBUTE_NAME_PROPERTY_KEY, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_XML_VALIDATION, true);
    samlData.put(SettingsBuilder.SECURITY_SIGNATURE_ALGORITHM, "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
    samlData.put(SettingsBuilder.SECURITY_DIGEST_ALGORITHM, "http://www.w3.org/2001/04/xmlenc#sha256");
    samlData.put(SettingsBuilder.SECURITY_REJECT_DEPRECATED_ALGORITHM, true);

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
}
