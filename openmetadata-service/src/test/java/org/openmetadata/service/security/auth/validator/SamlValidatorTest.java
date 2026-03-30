package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.List;
import javax.security.auth.x500.X500Principal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

class SamlValidatorTest {
  private static final String GENERIC_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDFTCCAf2gAwIBAgIUBCiHFtJHTPEqvG3EYX9D6wlZdGowDQYJKoZIhvcNAQEL
      BQAwGjEYMBYGA1UEAwwPc3NvLmV4YW1wbGUuY29tMB4XDTI2MDMwOTIxMTIyOVoX
      DTM2MDMwNjIxMTIyOVowGjEYMBYGA1UEAwwPc3NvLmV4YW1wbGUuY29tMIIBIjAN
      BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxL6GL7SModUczpZCRuT/l4008J6I
      zRT+up/P2oxib3pcNClJvGsTdwmCxynaNCocqvA7YR1VBSaAaPyyQP00R5J9LvSW
      nyFGBDiIPNeMHc19Fraptm8ThXUFh1DUeklY40qHSWk3aatNDh6m/syaC2O6yAE2
      9eWf5UjZEPIelVmxVEU5M2g8mnAMS1S8NuIhW1xTw+jl7aiMh5JwfGMCkaRehAvJ
      JdHXnk2y99AV2YGbfh6gsQjBy/orsBHudMVCkJeOYoPua3sFrxF5o0qR93GV6BmM
      fEVV6fa85HmvMONtnLZ/+TMe2mArMCwbRDR7Gq2GhQhw431Tz2xSk7o94wIDAQAB
      o1MwUTAdBgNVHQ4EFgQUCgAkFahh9VpOVHkQaC6Yfd+BabwwHwYDVR0jBBgwFoAU
      CgAkFahh9VpOVHkQaC6Yfd+BabwwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0B
      AQsFAAOCAQEADles53PRldbE7hvEuQ6t7qlWUzPZ5kGm62lIZ3SyEIXSiApuswp5
      ZUd2XxQV2KEh5xPUeqIgMbGdUnW/zmb71x3elQSTH7iZTcofEJN61vYfImt2qbK1
      y0Lf5SVYuVcaNpIFB12anhGAEI44hgW0fMuIrHo2g+WVBPuL2zw3xlwpotF0iUSh
      WgEIgpi5zwsDf6MgdAfx+FH3Y5xhiH3FgWiauzUpgSCwc1BpxgUIgCZb5XBi3G/S
      /7FDYorVDgHtcV8XG5DBLcxBgg3E3rhTQjU4s67h4fAue8Oi5fka8/WpquqE0+5r
      pZIcICI5lh7iG1DOMSfyKMM8Iqtzk2Y4OA==
      -----END CERTIFICATE-----
      """;

  private static final String GENERIC_PRIVATE_KEY =
      """
      -----BEGIN PRIVATE KEY-----
      MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDEvoYvtIyh1RzO
      lkJG5P+XjTTwnojNFP66n8/ajGJvelw0KUm8axN3CYLHKdo0Khyq8DthHVUFJoBo
      /LJA/TRHkn0u9JafIUYEOIg814wdzX0Wtqm2bxOFdQWHUNR6SVjjSodJaTdpq00O
      Hqb+zJoLY7rIATb15Z/lSNkQ8h6VWbFURTkzaDyacAxLVLw24iFbXFPD6OXtqIyH
      knB8YwKRpF6EC8kl0deeTbL30BXZgZt+HqCxCMHL+iuwEe50xUKQl45ig+5rewWv
      EXmjSpH3cZXoGYx8RVXp9rzkea8w422ctn/5Mx7aYCswLBtENHsarYaFCHDjfVPP
      bFKTuj3jAgMBAAECggEADYL7f92O8PL2slYNwYUAQVNlyNv3ui87GpcCH9jB+TT2
      jcXYy14GgrIpBJjiZEW7cp6NUsCVx6+aubBtD4Xe0sbZM7csJvaSh+oCqpGvt5ZB
      Wnol/UzzPW2ezmm7MJYb9X7MprqD9I0FUuHBB0EG7UmmmLjDTQToQ8df0khGgxbR
      o+h2rkbN+ll1TjO7BPIby4uQwKE38DF6I4ALlv4bUNrswFeU/So5YxVOTrcbZf4N
      3/ZAKiTVQ/cy3CKGjG9MgEA7JTmVwVDWQVezGfcP4vix3oDlPQL0fDMZ/4/7qdtG
      +P3AAKJgrg1C2uVR2snb3dnV4y5okXKM3pRuoDjhCQKBgQD7czWC127pJrQVvnCv
      aQGqaILWERNBQZPmc2qsWtC+fHFg1wsdzQez1G0BPofLzRBA5GHJSe4fX591ePER
      R5rfqTBWtbRtuP5qAuwnXTd17UVAhIsx/+5p7MWV1PxEAx9va9eHv/A8QAHSmnsz
      2wkpN+9vry9pAV8pfwHoLCsrGwKBgQDITebUqWomEFo34o6bK5Ew4nxrzJoimK4z
      kJ+HIuzdd4mjl/7b3AilanQLOHx3+1DMcQ//9ohNFEori8A8dZvcwOSQdvPeOtaA
      E4PpzDtebw+vdqSFsxfJe8eCPJYGUGrYiBmosgLoV52cCwL78BAkY9q5LyYf7C22
      hXdOTD9c2QKBgBUURWogkUWuXu5rtpqd3OviMwWrDMgtrS5mgozMWC9/0ylhHadz
      5q9moXS3Pz8Qg8pM2v262uF6bK22Y88lB5C0aD78oJGKLpnIgO+T2vBh4apU8i5Q
      3DW5CZ9T6YnyERKQIdNZfdQvMXfsR2PDevMfo0zjjL/qw4WBBjHmcf/9AoGAOHET
      IUuXuKAU+/hgHMNbBz5atvmRWTxSof8XpLmnqwQ7CZkT3JoU6Z+kkWDaWei8LM+T
      JZovcCDOgZTAl4jAYaUNAtQyBaXouXBGVIQTGpoK/nNdCrubcU/quP0ffSn94YQA
      TvPSM+w0YjsMHTfZJJfqkxIBGS+w9eSH6M09cYkCgYBoB4mURan//QAQh1+8agJU
      t6UDl5kRpap7jOoKZDFbdOu0/yd152yXrWKIPvZ66tQAi7AWNrtbzKpYhAt4OAiT
      FiHb4rHL/3ZjBTXjYQ/rN1yRWHhbV+S1CmYRFODM8KEoJV5eeLIwSF+fni7zg5Uc
      izze3uZpXUUKS2d34BAwEQ==
      -----END PRIVATE KEY-----
      """;

  private static final String AUTH0_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDJTCCAg2gAwIBAgIULZ1r/rr0mdEA8cQdGvwnzMQhUr8wDQYJKoZIhvcNAQEL
      BQAwIjEgMB4GA1UEAwwXZGV2LXRlbmFudC51cy5hdXRoMC5jb20wHhcNMjYwMzA5
      MjExMjI5WhcNMzYwMzA2MjExMjI5WjAiMSAwHgYDVQQDDBdkZXYtdGVuYW50LnVz
      LmF1dGgwLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAK8sipcc
      uD4R/voKmPdILRmwPRJr80zpiKh/oAgEtxrc37EeCKPeDWm+ZB3Sz5/j5Fs5Zb9Y
      gKReRWnEYhxpPrJSj5ycWsZF+OulobiRdCbYR6jEAEPbdWktVciqn4i+0iQlzN7/
      ed7RfTXyaUJ4Xbj5/ntYXjA43r7OySsuFi4OKDGhvRkAppvkeaAdHCjrMivzuyl6
      3BKxrjt2HE4w+dnKZ/I6OhwNwdpUimGV/b8JUgxO/3AloTvZISu/fjnlZ92tztf3
      RVFEX3LjlBS36qOvsvLAQH0dz05Q+yM0VQRtMnVZvkrbG3RxkzR36KET9Ywa/XPd
      2hmPo3sC4Di2wnMCAwEAAaNTMFEwHQYDVR0OBBYEFAiViSzuaWLd9QwVM9rFtCO2
      Na54MB8GA1UdIwQYMBaAFAiViSzuaWLd9QwVM9rFtCO2Na54MA8GA1UdEwEB/wQF
      MAMBAf8wDQYJKoZIhvcNAQELBQADggEBAIr+4Gh6nHwcvujAopFP/3m1lnzwJzg1
      ueQ7yk+o853zD1FmQ3ULHl5tYO5diHlbXFBQXc0zOju8kJ3zjbHONwLjxpoi0Ddm
      daCrAGrTkFC1QA0GFE7jbUcDXknb2xsLc3YfL+XeZsoJIJk6b9G1mfOLkMvcNkLn
      clFa8o+KxgQnh3bc8MGl51kR58zpPKMoFd8xgLXLrvob8XKOCXZkaSNd8UZfHQRe
      EBm4MOErrYPndxG8UdbzBCyqtgO21Weqg45D13ooI1IZMT68ybHKiw9uizzs2xr9
      uqamCw64gj8WAX2mWHoSY95BmfSw3byKH7qlIC1HRm05KOcLCmudAZI=
      -----END CERTIFICATE-----
      """;

  private static final String AZURE_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDKzCCAhOgAwIBAgIUUg1zCpmD5l6BO1bKZIlbrG6YMQMwDQYJKoZIhvcNAQEL
      BQAwJTEjMCEGA1UEAwwaTWljcm9zb2Z0IEF6dXJlIEZlZGVyYXRpb24wHhcNMjYw
      MzA5MjExMjI5WhcNMzYwMzA2MjExMjI5WjAlMSMwIQYDVQQDDBpNaWNyb3NvZnQg
      QXp1cmUgRmVkZXJhdGlvbjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
      AOsmoWfz2hJNaus9qTYm62Ds2fNgz22Ry1dcHTXKrtUZgrFSurXBpjQlN+EKtplH
      zm7K00vx4FG6CLmAf5KqiOrbdTHGrOBrpdPaGgPVIgZ7G9B2VZS0BxO+m67l7O8Y
      MbZLszq2XbJ7Knoq+Ji88wi0AG6Z/6Qi4VxlYt+Gg04Qx0CYAm/6uHtwWGL1f3Pe
      CPszpuuOE45ZTRZYR/bxB6zIqpfjeH7DJwEUKbhIIdpm/IBqhMiZ6vQR9se/sBli
      4/Uf/vOpbKyL8OIyUi56cgpTSKGBl6s8+TPOAM+R1OuqMFFr4UZoDgJIo1f5zlOB
      xjbisr3MCAHGmvHdvtAt4FUCAwEAAaNTMFEwHQYDVR0OBBYEFA/RAiy/7bWux4TN
      6gnXwPXfDGinMB8GA1UdIwQYMBaAFA/RAiy/7bWux4TN6gnXwPXfDGinMA8GA1Ud
      EwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAKPtXLe+JoDUJlsltVf0fqAN
      5lE/RukfXBiwEEZIqSblgYx5PSzmLvWumaWOv8mmgB2jAe/F1EeU4LT2V3hqHsP8
      E223bH2y32XrXpXJXS/an3CoMlhnrfcg8jUFcvBRXnXgLH4be1NNmn3tBj1z9Xut
      t2UzQ9rG6aKbFlN79gZOrXScG3TRfle+psg0u5CbpsITf6XvviVlu+ElPGkj1HH8
      1W/1Mh6Qx2x9kCtIrLytTUq0BCZZoO4/quszt5HGLC7lxWinb+JkJRCs04s0b6Cp
      x8bcUxqBl6rAdf3P5x+Luyfjp+DjxchtGnAhRbR18zynQTTZnuLP/8VDecGXYvE=
      -----END CERTIFICATE-----
      """;

  private SamlValidator validator;

  @BeforeEach
  void setUp() {
    validator = new SamlValidator();
  }

  @Test
  void validateSamlConfigurationRejectsMissingServiceProvider() {
    SamlSSOClientConfig samlConfig = new SamlSSOClientConfig();
    samlConfig.withIdp(new IdentityProviderConfig().withEntityId("https://sso.example.com"));

    FieldError error =
        validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

    assertNotNull(error);
    assertTrue(error.getError().contains("Service Provider"));
  }

  @Test
  void validateSamlConfigurationRejectsInvalidAcsPath() {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getSp().setAcs("https://sp.example.com/not-saml");

    FieldError error =
        validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_ACS_URL, error.getField());
    assertTrue(error.getError().contains("must end with"));
  }

  @Test
  void validateSamlConfigurationRejectsMissingIdpCertificate() {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setIdpX509Certificate(null);

    FieldError error =
        validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_CERT, error.getField());
  }

  @Test
  void validateSamlConfigurationSucceedsForReachableGenericProvider() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      FieldError error =
          validator.validateSamlConfiguration(
              new AuthenticationConfiguration(), baseConfig(server.url()));

      assertNull(error);
    }
  }

  @Test
  void validateSamlConfigurationRejectsAuth0CertificateMismatchForUrnEntityId() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setEntityId("urn:dev-tenant.us.auth0.com");

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_CERT, error.getField());
      assertTrue(error.getError().contains("Auth0 certificate validation failed"));
    }
  }

  @Test
  void validateSamlConfigurationAcceptsAuth0UrnEntityIdWithMatchingCertificate() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setEntityId("urn:dev-tenant.us.auth0.com");
      samlConfig.getIdp().setIdpX509Certificate(AUTH0_CERT);

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNull(error);
    }
  }

  @Test
  void validateSamlConfigurationRejectsMicrosoftCertificateForNonAzureProvider() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setIdpX509Certificate(AZURE_CERT);

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_CERT, error.getField());
      assertTrue(error.getError().contains("Invalid use of Microsoft Azure certificate"));
    }
  }

  @Test
  void validateSamlConfigurationAcceptsAzureConfigurationWhenMetadataMatches() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String openIdConfigUrl =
        "https://login.microsoftonline.com/" + tenantId + "/v2.0/.well-known/openid-configuration";
    String metadataUrl =
        "https://login.microsoftonline.com/"
            + tenantId
            + "/FederationMetadata/2007-06/FederationMetadata.xml";

    try (TestSsoServer server = TestSsoServer.start(200, "ok");
        MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(openIdConfigUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200, "{\"issuer\":\"https://sts.windows.net/" + tenantId + "/\"}"));
      http.when(() -> ValidationHttpUtil.safeGet(metadataUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200,
                  "<EntityDescriptor>"
                      + "urn:oasis:names:tc:SAML:2.0:protocol"
                      + "urn:oasis:names:tc:SAML:1.1:protocol"
                      + "</EntityDescriptor>"));

      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setEntityId("https://sts.windows.net/" + tenantId + "/");
      samlConfig.getIdp().setIdpX509Certificate(AZURE_CERT);
      samlConfig.getIdp().setNameId("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNull(error);
    }
  }

  @Test
  void validateSamlConfigurationReturnsSecurityValidationErrorsBeforeConnectivity() {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.setSecurity(new SamlSecurityConfig().withSendSignedAuthRequest(true));
    samlConfig.getSp().setSpPrivateKey(null);

    FieldError error =
        validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_KEY, error.getField());
  }

  @Test
  void validateSamlConfigurationReturnsConnectivityErrorsFromPublicEntryPoint() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(404, "missing")) {
      FieldError error =
          validator.validateSamlConfiguration(
              new AuthenticationConfiguration(), baseConfig(server.url()));

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
    }
  }

  @Test
  void validateSecurityConfigurationRequiresSpCertificateForSignedRequests() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getSp().setSpX509Certificate(null);
    samlConfig.setSecurity(new SamlSecurityConfig().withSendSignedAuthRequest(true));

    FieldError error =
        invokePrivate("validateSecurityConfiguration", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_CERT, error.getField());
  }

  @Test
  void validateSecurityConfigurationRequiresSpPrivateKeyForSignedRequests() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.setSecurity(new SamlSecurityConfig().withSendSignedAuthRequest(true));
    samlConfig.getSp().setSpX509Certificate(GENERIC_CERT);
    samlConfig.getSp().setSpPrivateKey(null);

    FieldError error =
        invokePrivate("validateSecurityConfiguration", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_KEY, error.getField());
  }

  @Test
  void validateCertificatesRejectsInvalidSpCertificateWhenSigningIsEnabled() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.setSecurity(new SamlSecurityConfig().withSendSignedAuthRequest(true));
    samlConfig
        .getSp()
        .setSpX509Certificate("-----BEGIN CERTIFICATE-----broken-----END CERTIFICATE-----");

    FieldError error = invokePrivate("validateCertificates", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_CERT, error.getField());
  }

  @Test
  void validateCertificatesHandlesMissingIdpConfigGracefully() throws Exception {
    FieldError error =
        invokePrivate("validateCertificates", SamlSSOClientConfig.class, new SamlSSOClientConfig());

    assertNotNull(error);
    assertTrue(error.getError().contains("Certificate validation failed"));
  }

  @Test
  void validateSecurityConfigurationRequiresIdpCertificateForAssertionValidation()
      throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setIdpX509Certificate(null);
    samlConfig.setSecurity(new SamlSecurityConfig().withWantAssertionsSigned(true));

    FieldError error =
        invokePrivate("validateSecurityConfiguration", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_CERT, error.getField());
  }

  @Test
  void validateBasicSamlConfigRejectsInvalidOktaEntityIds() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setEntityId("https://tenant.okta.com/app");

    FieldError error =
        invokePrivate("validateBasicSamlConfig", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
    assertTrue(error.getError().contains("Okta Entity ID should be in format"));
  }

  @Test
  void validateBasicSamlConfigRejectsInvalidCallbackUrls() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getSp().setCallback("not-a-url");

    FieldError error =
        invokePrivate("validateBasicSamlConfig", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_CALLBACK, error.getField());
  }

  @Test
  void validateBasicSamlConfigRejectsMissingSpEntityId() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getSp().setEntityId(null);

    FieldError error =
        invokePrivate("validateBasicSamlConfig", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_ENTITY_ID, error.getField());
  }

  @Test
  void validateBasicSamlConfigRejectsMissingIdentityProviderConfiguration() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.setIdp(null);

    FieldError error =
        invokePrivate("validateBasicSamlConfig", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertTrue(error.getError().contains("Identity Provider"));
  }

  @Test
  void validateBasicSamlConfigRejectsMissingIdentityProviderEntityId() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setEntityId(null);

    FieldError error =
        invokePrivate("validateBasicSamlConfig", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
  }

  @Test
  void validateBasicSamlConfigRejectsMissingSsoLoginUrl() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setSsoLoginUrl(null);

    FieldError error =
        invokePrivate("validateBasicSamlConfig", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
  }

  @Test
  void validateBasicSamlConfigRejectsInvalidIdentityProviderEntityIds() throws Exception {
    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setEntityId("not-a-url-or-urn");

    FieldError error =
        invokePrivate("validateBasicSamlConfig", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
  }

  @Test
  void validateAzureAdTenantRejectsUnknownTenant() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String openIdConfigUrl =
        "https://login.microsoftonline.com/" + tenantId + "/v2.0/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(openIdConfigUrl))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(404, "missing"));

      FieldError error =
          invokePrivate(
              "validateAzureAdTenant",
              new Class<?>[] {String.class, String.class},
              "https://sts.windows.net/" + tenantId + "/",
              null);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
      assertTrue(error.getError().contains("tenant not found"));
    }
  }

  @Test
  void validateAzureAdTenantRejectsIssuerMismatch() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String openIdConfigUrl =
        "https://login.microsoftonline.com/" + tenantId + "/v2.0/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(openIdConfigUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200, "{\"issuer\":\"https://sts.windows.net/other-tenant/\"}"));

      FieldError error =
          invokePrivate(
              "validateAzureAdTenant",
              new Class<?>[] {String.class, String.class},
              "https://sts.windows.net/" + tenantId + "/",
              null);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
      assertTrue(error.getError().contains("Tenant ID mismatch"));
    }
  }

  @Test
  void validateAzureAdTenantRejectsInvalidTenantIds() throws Exception {
    FieldError error =
        invokePrivate(
            "validateAzureAdTenant",
            new Class<?>[] {String.class, String.class},
            "https://sts.windows.net/not-a-guid/",
            null);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
    assertTrue(error.getError().contains("Invalid Azure AD tenant ID format"));
  }

  @Test
  void validateAzureAdTenantReturnsNullWhenLookupFails() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String openIdConfigUrl =
        "https://login.microsoftonline.com/" + tenantId + "/v2.0/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(openIdConfigUrl))
          .thenThrow(new IOException("boom"));

      FieldError error =
          invokePrivate(
              "validateAzureAdTenant",
              new Class<?>[] {String.class, String.class},
              "https://sts.windows.net/" + tenantId + "/",
              null);

      assertNull(error);
    }
  }

  @Test
  void validateAzureAdTenantUsesSsoUrlToExtractTenantIds() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String openIdConfigUrl =
        "https://login.microsoftonline.com/" + tenantId + "/v2.0/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(openIdConfigUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200, "{\"issuer\":\"https://login.microsoftonline.com/" + tenantId + "/v2.0\"}"));

      FieldError error =
          invokePrivate(
              "validateAzureAdTenant",
              new Class<?>[] {String.class, String.class},
              "urn:azure-ad",
              "https://login.microsoftonline.com/" + tenantId + "/saml2");

      assertNull(error);
    }
  }

  @Test
  void validateAzureAdTenantHandlesMicrosoftOnlineEntityIds() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String openIdConfigUrl =
        "https://login.microsoftonline.com/" + tenantId + "/v2.0/.well-known/openid-configuration";

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(openIdConfigUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200, "{\"issuer\":\"https://login.microsoftonline.com/" + tenantId + "/v2.0\"}"));

      FieldError error =
          invokePrivate(
              "validateAzureAdTenant",
              new Class<?>[] {String.class, String.class},
              "https://login.microsoftonline.com/" + tenantId + "/",
              null);

      assertNull(error);
    }
  }

  @Test
  void validateAzureAdTenantRejectsConfigurationsWithoutTenantIds() throws Exception {
    FieldError error =
        invokePrivate(
            "validateAzureAdTenant",
            new Class<?>[] {String.class, String.class},
            "urn:azure-ad",
            null);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
    assertTrue(error.getError().contains("Could not extract tenant ID"));
  }

  @Test
  void validateAzureAdTenantReturnsFieldErrorsWhenEntityIdIsNull() throws Exception {
    FieldError error =
        invokePrivate(
            "validateAzureAdTenant", new Class<?>[] {String.class, String.class}, null, null);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, error.getField());
    assertTrue(error.getError().contains("Azure tenant validation failed"));
  }

  @Test
  void validateNameIdFormatWithIdpRejectsInvalidFormat() throws Exception {
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("https://sso.example.com")
            .withSsoLoginUrl("https://sso.example.com/login")
            .withNameId("not-a-saml-nameid");

    FieldError error =
        invokePrivate("validateNameIdFormatWithIdp", IdentityProviderConfig.class, idpConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_NAME_ID, error.getField());
    assertTrue(error.getError().contains("Invalid NameID format"));
  }

  @Test
  void validateNameIdFormatWithIdpRejectsAzureUnsupportedFormat() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String metadataUrl =
        "https://login.microsoftonline.com/"
            + tenantId
            + "/FederationMetadata/2007-06/FederationMetadata.xml";
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("https://sts.windows.net/" + tenantId + "/")
            .withSsoLoginUrl("http://localhost/unused")
            .withNameId("urn:oasis:names:tc:SAML:2.0:nameid-format:entity");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(metadataUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200,
                  "<EntityDescriptor>"
                      + "urn:oasis:names:tc:SAML:2.0:protocol"
                      + "urn:oasis:names:tc:SAML:1.1:protocol"
                      + "</EntityDescriptor>"));

      FieldError error =
          invokePrivate("validateNameIdFormatWithIdp", IdentityProviderConfig.class, idpConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_NAME_ID, error.getField());
      assertTrue(error.getError().contains("not supported by Azure AD"));
    }
  }

  @Test
  void validateNameIdFormatWithIdpAllowsAzureMultiTenantEndpoints() throws Exception {
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("https://login.microsoftonline.com/common/")
            .withSsoLoginUrl("http://localhost/unused")
            .withNameId("urn:oasis:names:tc:SAML:2.0:nameid-format:persistent");

    FieldError error =
        invokePrivate("validateNameIdFormatWithIdp", IdentityProviderConfig.class, idpConfig);

    assertNull(error);
  }

  @Test
  void validateAzureNameIdFormatAcceptsCommonSaml20Formats() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String metadataUrl =
        "https://login.microsoftonline.com/"
            + tenantId
            + "/FederationMetadata/2007-06/FederationMetadata.xml";
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("https://sts.windows.net/" + tenantId + "/")
            .withSsoLoginUrl("http://localhost/unused");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(metadataUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200,
                  "<EntityDescriptor>urn:oasis:names:tc:SAML:2.0:protocol</EntityDescriptor>"));

      FieldError persistentError =
          invokePrivate(
              "validateAzureNameIdFormat",
              new Class<?>[] {IdentityProviderConfig.class, String.class},
              idpConfig,
              "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent");
      FieldError emailWarning =
          invokePrivate(
              "validateAzureNameIdFormat",
              new Class<?>[] {IdentityProviderConfig.class, String.class},
              idpConfig,
              "urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress");

      assertNull(persistentError);
      assertNull(emailWarning);
    }
  }

  @Test
  void validateAzureNameIdFormatReturnsNullWhenMetadataIsUnavailable() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String metadataUrl =
        "https://login.microsoftonline.com/"
            + tenantId
            + "/FederationMetadata/2007-06/FederationMetadata.xml";
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("https://sts.windows.net/" + tenantId + "/")
            .withSsoLoginUrl("http://localhost/unused");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(metadataUrl))
          .thenReturn(new ValidationHttpUtil.HttpResponseData(503, "unavailable"));

      FieldError error =
          invokePrivate(
              "validateAzureNameIdFormat",
              new Class<?>[] {IdentityProviderConfig.class, String.class},
              idpConfig,
              "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent");

      assertNull(error);
    }
  }

  @Test
  void validateAzureNameIdFormatReturnsNullWhenMetadataLookupThrows() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String metadataUrl =
        "https://login.microsoftonline.com/"
            + tenantId
            + "/FederationMetadata/2007-06/FederationMetadata.xml";
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("https://sts.windows.net/" + tenantId + "/")
            .withSsoLoginUrl("http://localhost/unused");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(metadataUrl)).thenThrow(new IOException("boom"));

      FieldError error =
          invokePrivate(
              "validateAzureNameIdFormat",
              new Class<?>[] {IdentityProviderConfig.class, String.class},
              idpConfig,
              "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent");

      assertNull(error);
    }
  }

  @Test
  void validateAzureNameIdFormatUsesSsoUrlWhenEntityIdIsMissing() throws Exception {
    String tenantId = "11111111-2222-3333-4444-555555555555";
    String metadataUrl =
        "https://login.microsoftonline.com/"
            + tenantId
            + "/FederationMetadata/2007-06/FederationMetadata.xml";
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("urn:azure-ad")
            .withSsoLoginUrl("https://login.microsoftonline.com/" + tenantId + "/saml2");

    try (MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(metadataUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200,
                  "<EntityDescriptor>urn:oasis:names:tc:SAML:2.0:protocol</EntityDescriptor>"));

      FieldError error =
          invokePrivate(
              "validateAzureNameIdFormat",
              new Class<?>[] {IdentityProviderConfig.class, String.class},
              idpConfig,
              "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent");

      assertNull(error);
    }
  }

  @Test
  void validateAzureNameIdFormatAllowsMultiTenantSsoUrls() throws Exception {
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("urn:azure-ad")
            .withSsoLoginUrl("https://login.microsoftonline.com/common/saml2");

    FieldError error =
        invokePrivate(
            "validateAzureNameIdFormat",
            new Class<?>[] {IdentityProviderConfig.class, String.class},
            idpConfig,
            "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent");

    assertNull(error);
  }

  @Test
  void validateNameIdFormatWithIdpAllowsMissingNameIds() throws Exception {
    IdentityProviderConfig idpConfig =
        new IdentityProviderConfig()
            .withEntityId("https://sso.example.com")
            .withSsoLoginUrl("https://sso.example.com/login");

    FieldError error =
        invokePrivate("validateNameIdFormatWithIdp", IdentityProviderConfig.class, idpConfig);

    assertNull(error);
  }

  @Test
  void validateNameIdFormatWithIdpHandlesNullConfigs() throws Exception {
    FieldError error =
        invokePrivate("validateNameIdFormatWithIdp", IdentityProviderConfig.class, null);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_NAME_ID, error.getField());
  }

  @Test
  void validateIdpConnectivityMaps404ToFieldError() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(404, "missing")) {
      FieldError error =
          invokePrivate(
              "validateIdpConnectivity", SamlSSOClientConfig.class, baseConfig(server.url()));

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
      assertTrue(error.getError().contains("HTTP 404"));
    }
  }

  @Test
  void validateIdpConnectivityTreatsSamlClientErrorsAsWarnings() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(400, "invalid saml request")) {
      FieldError error =
          invokePrivate(
              "validateIdpConnectivity", SamlSSOClientConfig.class, baseConfig(server.url()));

      assertNull(error);
    }
  }

  @Test
  void validateIdpConnectivityMaps405And5xxResponses() throws Exception {
    try (TestSsoServer methodNotAllowed = TestSsoServer.start(405, "method");
        TestSsoServer serverError = TestSsoServer.start(503, "unavailable")) {
      FieldError methodError =
          invokePrivate(
              "validateIdpConnectivity",
              SamlSSOClientConfig.class,
              baseConfig(methodNotAllowed.url()));
      FieldError serverErrorField =
          invokePrivate(
              "validateIdpConnectivity", SamlSSOClientConfig.class, baseConfig(serverError.url()));

      assertNotNull(methodError);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, methodError.getField());
      assertNotNull(serverErrorField);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, serverErrorField.getField());
    }
  }

  @Test
  void validateIdpConnectivityMapsClientErrorsWithoutSamlHints() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(400, "plain client error")) {
      FieldError error =
          invokePrivate(
              "validateIdpConnectivity", SamlSSOClientConfig.class, baseConfig(server.url()));

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
    }
  }

  @Test
  void validateIdpConnectivityTreatsMalformedUrlsAsWarnings() throws Exception {
    FieldError error =
        invokePrivate(
            "validateIdpConnectivity", SamlSSOClientConfig.class, baseConfig("http://bad host"));

    assertNull(error);
  }

  @Test
  void readResponseSnippetReturnsEmptyWhenConnectionHasNoReadableStreams() throws Exception {
    HttpURLConnection connection = mock(HttpURLConnection.class);
    when(connection.getErrorStream()).thenReturn(null);
    when(connection.getInputStream()).thenThrow(new IOException("no body"));

    String snippet = invokePrivate("readResponseSnippet", HttpURLConnection.class, connection);

    assertEquals("", snippet);
  }

  @Test
  void readResponseSnippetFallsBackToInputStreams() throws Exception {
    HttpURLConnection connection = mock(HttpURLConnection.class);
    when(connection.getErrorStream()).thenReturn(null);
    when(connection.getInputStream())
        .thenReturn(new java.io.ByteArrayInputStream("from-input".getBytes()));

    String snippet = invokePrivate("readResponseSnippet", HttpURLConnection.class, connection);

    assertEquals("from-input", snippet);
  }

  @Test
  void createTestSamlRequestFallsBackWhenConfigIsIncomplete() throws Exception {
    String request =
        invokePrivate(
            "createTestSamlRequest", SamlSSOClientConfig.class, new SamlSSOClientConfig());

    assertEquals("dGVzdA==", request);
  }

  @Test
  void validateX509CertificateTwoArgumentOverloadRejectsBrokenPem() {
    InvocationTargetException exception =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invokePrivate(
                    "validateX509Certificate",
                    new Class<?>[] {String.class, String.class},
                    "-----BEGIN CERTIFICATE-----broken-----END CERTIFICATE-----",
                    "SP X509 certificate"));

    assertInstanceOf(CertificateException.class, exception.getCause());
  }

  @Test
  void validateX509CertificateRejectsHeaderOnlyPemBlocks() {
    InvocationTargetException exception =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invokePrivate(
                    "validateX509Certificate",
                    new Class<?>[] {String.class, String.class},
                    "-----BEGIN CERTIFICATE----- -----END CERTIFICATE-----",
                    "IdP X509 certificate"));

    assertTrue(exception.getCause().getMessage().contains("empty after removing PEM headers"));
  }

  @Test
  void validateIdpCertificateAgainstConfigAllowsMissingCommonNames() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("O=Example"));

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        baseConfig("http://localhost/unused"));
  }

  @Test
  void validateIdpCertificateAgainstConfigAllowsOktaWildcardCertificates() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("CN=*.okta.com"));

    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setEntityId("https://www.okta.com/app123");

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        samlConfig);
  }

  @Test
  void validateIdpCertificateAgainstConfigThrowsForAuth0Mismatches() {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("CN=wrong.auth0.com"));

    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setEntityId("urn:dev-tenant.us.auth0.com");

    InvocationTargetException exception =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invokePrivate(
                    "validateIdpCertificateAgainstConfig",
                    new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
                    cert,
                    samlConfig));

    assertInstanceOf(CertificateException.class, exception.getCause());
  }

  @Test
  void validateIdpCertificateAgainstConfigThrowsForAzureMismatches() {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("CN=generic.example.com"));

    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig
        .getIdp()
        .setEntityId("https://sts.windows.net/11111111-2222-3333-4444-555555555555/");

    InvocationTargetException exception =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invokePrivate(
                    "validateIdpCertificateAgainstConfig",
                    new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
                    cert,
                    samlConfig));

    assertInstanceOf(CertificateException.class, exception.getCause());
  }

  @Test
  void validateIdpCertificateAgainstConfigInspectsSubjectAlternativeNames() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("CN=other.example.com"));
    when(cert.getSubjectAlternativeNames())
        .thenReturn(
            List.of(List.of(2, "login.sso.example.com"), List.of(6, "urn:sso.example.com")));

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        baseConfig("http://localhost/unused"));
  }

  @Test
  void validateIdpCertificateAgainstConfigHandlesSanInspectionFailures() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("CN=other.example.com"));
    when(cert.getSubjectAlternativeNames()).thenThrow(new RuntimeException("san boom"));

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        baseConfig("http://localhost/unused"));
  }

  @Test
  void validateIdpCertificateAgainstConfigHandlesUnexpectedPrincipalFailures() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenThrow(new RuntimeException("subject boom"));

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        baseConfig("http://localhost/unused"));
  }

  @Test
  void extractDomainFromUrlHandlesUrnHttpAndBareDomains() throws Exception {
    assertEquals(
        "dev-tenant.us.auth0.com",
        invokePrivate("extractDomainFromUrl", String.class, "urn:dev-tenant.us.auth0.com"));
    assertEquals(
        "sso.example.com",
        invokePrivate("extractDomainFromUrl", String.class, "https://sso.example.com/login"));
    assertEquals(
        "custom.example.com",
        invokePrivate("extractDomainFromUrl", String.class, "custom.example.com"));
  }

  @Test
  void extractDomainFromUrlReturnsNullForInvalidInputs() throws Exception {
    assertNull(invokePrivate("extractDomainFromUrl", String.class, "ht!tp://bad"));
    assertNull(invokePrivate("extractDomainFromUrl", String.class, "plain-text"));
    assertNull(invokePrivate("extractDomainFromUrl", String.class, "urn:tenant"));
  }

  @Test
  void extractCnFromDnReturnsNullWhenInputIsNull() throws Exception {
    assertNull(invokePrivate("extractCNFromDN", String.class, null));
  }

  private SamlSSOClientConfig baseConfig(String ssoUrl) {
    return new SamlSSOClientConfig()
        .withSp(
            new ServiceProviderConfig()
                .withEntityId("https://sp.example.com/entity")
                .withAcs("https://sp.example.com/api/v1/saml/acs")
                .withCallback("https://sp.example.com/callback")
                .withSpX509Certificate(GENERIC_CERT)
                .withSpPrivateKey(GENERIC_PRIVATE_KEY))
        .withIdp(
            new IdentityProviderConfig()
                .withEntityId("https://sso.example.com/metadata")
                .withSsoLoginUrl(ssoUrl)
                .withIdpX509Certificate(GENERIC_CERT));
  }

  @SuppressWarnings("unchecked")
  private <T> T invokePrivate(String methodName, Class<?> parameterType, Object argument)
      throws Exception {
    return invokePrivate(methodName, new Class<?>[] {parameterType}, argument);
  }

  @SuppressWarnings("unchecked")
  private <T> T invokePrivate(String methodName, Class<?>[] parameterTypes, Object... arguments)
      throws Exception {
    Method method = SamlValidator.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return (T) method.invoke(validator, arguments);
  }

  private record TestSsoServer(HttpServer server, String url) implements AutoCloseable {
    static TestSsoServer start(int statusCode, String body) throws IOException {
      HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
      server.createContext(
          "/sso",
          exchange -> {
            byte[] payload = body.getBytes();
            exchange.sendResponseHeaders(statusCode, payload.length);
            try (OutputStream responseBody = exchange.getResponseBody()) {
              responseBody.write(payload);
            }
          });
      server.start();
      return new TestSsoServer(
          server, "http://localhost:" + server.getAddress().getPort() + "/sso");
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }
}
