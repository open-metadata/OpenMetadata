package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.ProtocolException;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Signature;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
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

  /**
   * Okta issues application signing certificates with the org short name as CN (never a domain),
   * while the IdP Entity ID is always {@code http://www.okta.com/{appId}}. See issue #28619.
   */
  private static final String OKTA_ORG_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDyzCCArOgAwIBAgIUIZV2P9D5F0TyWYkhelWTeh0aQEowDQYJKoZIhvcNAQEL
      BQAwdTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcM
      DVNhbiBGcmFuY2lzY28xDTALBgNVBAoMBE9rdGExFDASBgNVBAsMC1NTT1Byb3Zp
      ZGVyMRQwEgYDVQQDDAtleGFtcGxlLW9yZzAeFw0yNjA5MTYyMDQ1MjNaFw0zNjA5
      MTMyMDQ1MjNaMHUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRYw
      FAYDVQQHDA1TYW4gRnJhbmNpc2NvMQ0wCwYDVQQKDARPa3RhMRQwEgYDVQQLDAtT
      U09Qcm92aWRlcjEUMBIGA1UEAwwLZXhhbXBsZS1vcmcwggEiMA0GCSqGSIb3DQEB
      AQUAA4IBDwAwggEKAoIBAQDVQvEms8hTsAV8LUUx8uTQhxER/Hf3+yx3LPjMD+KY
      +4YpRHhQk3IY6r3DOQvT/PsUUWuqbRyYmGWiXkDyPsQAGUd3HW63fAcX+0TfBYEz
      75pt9U/QYhjJQAvmBmxqrak25bImKEZln7/+65zBS8Ohs9TYFBAT1lfaCBifhh0A
      80FkQXl8/5thnZAaNaFK3YIJfd3PBpMt2uGYOxo6xJbKS9NSGZLc3gRPRqcLhNx9
      01n8CxwFrCwqbY3urJ2rejPIaCZ+iVaJhFzuM1i1sB3H7/9+U6Wns1Is7a+OZLY8
      l41nDougHYvwwQaWA9xZ5lHPIiTdE9UWlHS53pfkp2qdAgMBAAGjUzBRMB0GA1Ud
      DgQWBBT5mtJZvkkmbFeAdkQt1ka2gyfakTAfBgNVHSMEGDAWgBT5mtJZvkkmbFeA
      dkQt1ka2gyfakTAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQCI
      /vPj2Z3lk9lvlnSsoXCpSxGfkxR3XSy/Pkm4CTPLN0XXhVKjyPTb2kdqM8AXjrID
      qehxhNunicS3+w3bwK4XZ4gTxpXnOflkXE+B38/1+rz9QQwiIx8q0B3thspazkm3
      aawU4aQEwSWygI8sXuxkShru5hHcwXWRA5F5s5kpiFK50FLOqWbOukLMSFoVNu1D
      Y8or/But9KUsAfHy294vbQAOj4kI0SYqBvhhlpJxXq1vMFtBiiwKeNIxE0mW240w
      b0/XIHowzxARt4SAZS+0jpaHqBESyanV8iVNqx8heeW+odH2cBkE0ic6t6/s3SrD
      V7z+p03MrlFxMur28rIH
      -----END CERTIFICATE-----
      """;

  private static final String OKTA_ENTITY_ID = "http://www.okta.com/exk1a2b3c4d5";

  /**
   * Self-signed, {@code CN=auth.example.com, O=Auth0}, valid 2026-09 to 2036-09 — the certificate an
   * Auth0 tenant on a custom domain signs with, whose CN is that domain rather than the
   * {@code .auth0.com} tenant host its Entity ID uses.
   */
  private static final String AUTH0_CUSTOM_DOMAIN_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDyzCCArOgAwIBAgIUOT6JVV3WC/4YZo6y/nFgX2MatPYwDQYJKoZIhvcNAQEL
      BQAwdTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcM
      B1NlYXR0bGUxDjAMBgNVBAoMBUF1dGgwMRQwEgYDVQQLDAtTU09Qcm92aWRlcjEZ
      MBcGA1UEAwwQYXV0aC5leGFtcGxlLmNvbTAeFw0yNjA5MTgwOTM3MzFaFw0zNjA5
      MTUwOTM3MzFaMHUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAw
      DgYDVQQHDAdTZWF0dGxlMQ4wDAYDVQQKDAVBdXRoMDEUMBIGA1UECwwLU1NPUHJv
      dmlkZXIxGTAXBgNVBAMMEGF1dGguZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3DQEB
      AQUAA4IBDwAwggEKAoIBAQDM1w9Hl/70gFeFfqywrSi8I+DasQoqXJWHSmqvfBQw
      NLrN4U8L4ud2nmfyY+qzPWHJr1V5wys0TDcmozmUxsDtZH4khcTE1JMv4abBoKcM
      WNwYffXJfYjQ71BjnZsVnxPcq5Ixxtfq60XPy6Qfjw8cxeniHDWjUlTCaTTPK6Qq
      rDpOPekcRE2LZQGUiNsW0UkSEZ6vGdi1WPAWgQKhiQTx/nEtnOCEiPyeWkxK0uOe
      KCP6LMKD2avy+2VArJjiVxjZoH0GykK71rFvBSf4xJcvdLw9APGRcjJVmzV3MUo4
      /2WRCzM8tW2/fH+8xU33i0Ub5KGkUCU1f3m2BitPu5BLAgMBAAGjUzBRMB0GA1Ud
      DgQWBBTUpOXNCEKm3v29sDWddBeC8NTHpDAfBgNVHSMEGDAWgBTUpOXNCEKm3v29
      sDWddBeC8NTHpDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAm
      CTeFF7Hgo4DvlmgEZSH2CO8OncEuLKnSwjIusb9MTkrFdcmlR9sZeQzzDy8H5RQ7
      68PUqNWsGt9lVwZhm/A4XzXPyIZLiH20cGaZs6PqXi+ycT74LsUAq6/+zq8WLSua
      Uj4nZnUyYJ7TDNc+lQYbAmEXENFa4OQT6sEYho18xiWafcF4mmE+3NugviSqR54J
      UFa2CtLwbGTs/IrGJzgv0Ti5atSxF/8/gJzRCPp/rEOhmCFG8X0RKYpT2O0clf+7
      nPq7sRFeMMIEX8GsxgvaahcgLZ2QHa075ZDSSxNXVHy3J8niKrAjnHEE4n52yXLC
      NM3Pv29cF9tNA0rqilc7
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

  /**
   * Issue #28619: Okta signs with a cert whose CN is the org short name, never the Entity ID host,
   * so requiring CN to equal {@code www.okta.com} rejected every legitimate Okta configuration.
   */
  @Test
  void validateSamlConfigurationAcceptsOktaOrgNameCertificate() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setEntityId(OKTA_ENTITY_ID);
      samlConfig.getIdp().setIdpX509Certificate(OKTA_ORG_CERT);

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNull(error);
    }
  }

  /**
   * An Auth0 tenant on a custom domain signs with that domain while its Entity ID stays on the
   * tenant host, so CN and Entity ID host are different namespaces — the same shape as the Okta
   * case, and what the removed exact-match rule rejected.
   */
  @Test
  void validateSamlConfigurationAcceptsAuth0CustomDomainCertificate() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setEntityId("urn:dev-tenant.us.auth0.com");
      samlConfig.getIdp().setIdpX509Certificate(AUTH0_CUSTOM_DOMAIN_CERT);

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNull(error);
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
  void validateSamlConfigurationAcceptsMicrosoftCertificateForNonAzureProvider() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setIdpX509Certificate(AZURE_CERT);

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNull(error);
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

  /**
   * An Azure AD tenant GUID entered in upper case (e.g. transcribed from a tool that renders GUIDs
   * in upper case) must be accepted end-to-end. Azure's OpenID-config endpoint returns a
   * lowercase issuer for an upper case path GUID, so both the format check and the issuer
   * comparison must be case-insensitive.
   */
  @Test
  void validateSamlConfigurationAcceptsUppercaseAzureTenantGuid() throws Exception {
    String tenantId = "A1B2C3D4-E5F6-7890-1234-567890ABCDEF";
    String normalizedTenantId = tenantId.toLowerCase(Locale.ROOT);
    String openIdConfigUrl =
        "https://login.microsoftonline.com/"
            + normalizedTenantId
            + "/v2.0/.well-known/openid-configuration";

    try (TestSsoServer server = TestSsoServer.start(200, "ok");
        MockedStatic<ValidationHttpUtil> http = mockStatic(ValidationHttpUtil.class)) {
      http.when(() -> ValidationHttpUtil.safeGet(openIdConfigUrl))
          .thenReturn(
              new ValidationHttpUtil.HttpResponseData(
                  200, "{\"issuer\":\"https://sts.windows.net/" + normalizedTenantId + "/\"}"));

      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.getIdp().setEntityId("https://sts.windows.net/" + tenantId + "/");
      samlConfig.getIdp().setIdpX509Certificate(AZURE_CERT);

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
  void validateSamlConfigurationSignsTheCheckRequestWhenRequestSigningIsOn() throws Exception {
    try (SigningIdp idp = SigningIdp.start()) {
      SamlSSOClientConfig samlConfig = baseConfig(idp.url());
      samlConfig.setSecurity(new SamlSecurityConfig().withSendSignedAuthRequest(true));

      FieldError error =
          validator.validateSamlConfiguration(new AuthenticationConfiguration(), samlConfig);

      assertNull(error);
      assertTrue(idp.acceptedSignedRequest(), "the IdP must have verified a signed request");
    }
  }

  @Test
  void validateSamlConfigurationShowsTheIdpReasonWhenItRejectsAnUnsignedRequest() throws Exception {
    try (SigningIdp idp = SigningIdp.start()) {
      FieldError error =
          validator.validateSamlConfiguration(
              new AuthenticationConfiguration(), baseConfig(idp.url()));

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
      assertEquals(
          "The identity provider rejected the SAML sign-in request (HTTP 400): "
              + IdpErrorResponseTest.ENTRA_UNSIGNED_REQUEST_REASON,
          error.getError());
    }
  }

  @Test
  void validateIdpConnectivityReportsAnSpKeyThatCannotSignRequests() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.setSecurity(new SamlSecurityConfig().withSendSignedAuthRequest(true));
      samlConfig.getSp().setSpPrivateKey(pkcs1PrivateKey());

      FieldError error =
          invokePrivate("validateIdpConnectivity", SamlSSOClientConfig.class, samlConfig);

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_KEY, error.getField());
      assertTrue(error.getError().contains("PKCS#8"));
    }
  }

  @Test
  void validateIdpConnectivityReportsSettingsTheLiveLoginCannotBuild() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(200, "ok")) {
      SamlSSOClientConfig samlConfig = baseConfig(server.url());
      samlConfig.setSecurity(new SamlSecurityConfig().withWantAssertionEncrypted(true));
      samlConfig.getSp().withSpX509Certificate(null).setSpPrivateKey(null);

      FieldError error =
          invokePrivate("validateIdpConnectivity", SamlSSOClientConfig.class, samlConfig);

      assertNotNull(error);
      assertEquals("", error.getField());
      assertTrue(error.getError().startsWith("Could not build the SAML sign-in request: "));
    }
  }

  @Test
  void validateIdpConnectivityReportsSamlClientErrorsWithTheIdpReason() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(400, "invalid saml request")) {
      FieldError error =
          invokePrivate(
              "validateIdpConnectivity", SamlSSOClientConfig.class, baseConfig(server.url()));

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
      assertEquals(
          "The identity provider rejected the SAML sign-in request (HTTP 400): invalid saml request",
          error.getError());
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
      assertEquals(
          "SSO URL is not accessible (HTTP 503): unavailable", serverErrorField.getError());
    }
  }

  @Test
  void validateIdpConnectivityMapsClientErrorsWithoutAReadableReason() throws Exception {
    try (TestSsoServer server = TestSsoServer.start(400, "")) {
      FieldError error =
          invokePrivate(
              "validateIdpConnectivity", SamlSSOClientConfig.class, baseConfig(server.url()));

      assertNotNull(error);
      assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
      assertTrue(
          error
              .getError()
              .startsWith("The identity provider rejected the SAML sign-in request (HTTP 400)."));
    }
  }

  @Test
  void validateSamlConfigurationRejectsMalformedSsoUrlsBeforeTheCheckRequest() {
    FieldError error =
        validator.validateSamlConfiguration(
            new AuthenticationConfiguration(), baseConfig("http://bad host"));

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, error.getField());
    assertTrue(error.getError().startsWith("Invalid SAML IdP SSO Login URL"));
  }

  @Test
  void validateIdpConnectivityTreatsUnreachableIdpsAsWarnings() throws Exception {
    FieldError error =
        invokePrivate(
            "validateIdpConnectivity",
            SamlSSOClientConfig.class,
            baseConfig("http://localhost:0/sso"));

    assertNull(error);
  }

  @Test
  void readResponseBodyReturnsEmptyWhenConnectionHasNoReadableStreams() throws Exception {
    HttpURLConnection connection = mock(HttpURLConnection.class);
    when(connection.getErrorStream()).thenReturn(null);
    when(connection.getInputStream()).thenThrow(new IOException("no body"));

    String body = invokePrivate("readResponseBody", HttpURLConnection.class, connection);

    assertEquals("", body);
  }

  @Test
  void readResponseBodyFallsBackToInputStreams() throws Exception {
    HttpURLConnection connection = mock(HttpURLConnection.class);
    when(connection.getErrorStream()).thenReturn(null);
    when(connection.getInputStream())
        .thenReturn(new java.io.ByteArrayInputStream("from-input".getBytes()));

    String body = invokePrivate("readResponseBody", HttpURLConnection.class, connection);

    assertEquals("from-input", body);
  }

  @Test
  void readResponseBodyClosesReadableStreams() throws Exception {
    TrackingInputStream inputStream = new TrackingInputStream("from-error".getBytes());
    HttpURLConnection connection = mock(HttpURLConnection.class);
    when(connection.getErrorStream()).thenReturn(inputStream);

    String body = invokePrivate("readResponseBody", HttpURLConnection.class, connection);

    assertEquals("from-error", body);
    assertTrue(inputStream.isClosed());
  }

  @Test
  void validateIdpConnectivityDisconnectsConnections() throws Exception {
    TrackingHttpURLConnection connection = new TrackingHttpURLConnection(400, "plain client error");
    validator = spy(validator);
    doReturn(connection).when(validator).openConnection(any(URL.class));

    FieldError error =
        invokePrivate(
            "validateIdpConnectivity",
            SamlSSOClientConfig.class,
            baseConfig("https://sso.example.com"));

    assertNotNull(error);
    assertTrue(connection.isDisconnected());
    assertTrue(connection.getBodyStream().isClosed());
  }

  /** The server must never send the probe to a metadata address, whatever the admin typed. */
  @Test
  void validateIdpConnectivityNeverProbesMetadataAddress() throws Exception {
    validator = spy(validator);

    FieldError error =
        invokePrivate(
            "validateIdpConnectivity",
            SamlSSOClientConfig.class,
            baseConfig("http://169.254.169.254/latest/meta-data/"));

    assertNull(error);
    verify(validator, never()).openConnection(any(URL.class));
  }

  /**
   * An identity provider on a private network is never probed, but the live login still cannot
   * sign with a key OneLogin cannot load, so the check reports it without sending anything.
   */
  @Test
  void validateIdpConnectivityReportsAnUnusableSpKeyForAnIdpItMayNotProbe() throws Exception {
    validator = spy(validator);
    SamlSSOClientConfig samlConfig = baseConfig("http://169.254.169.254/latest/meta-data/");
    samlConfig.setSecurity(new SamlSecurityConfig().withSendSignedAuthRequest(true));
    samlConfig.getSp().setSpPrivateKey(pkcs1PrivateKey());

    FieldError error =
        invokePrivate("validateIdpConnectivity", SamlSSOClientConfig.class, samlConfig);

    assertNotNull(error);
    assertEquals(ValidationErrorBuilder.FieldPaths.SAML_SP_KEY, error.getField());
    verify(validator, never()).openConnection(any(URL.class));
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
  void validateIdpCertificateAgainstConfigAllowsOktaOrgNameCertificates() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN())
        .thenReturn(
            new X500Principal(
                "CN=example-org, OU=SSOProvider, O=Okta, L=San Francisco, ST=California, C=US"));

    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setEntityId(OKTA_ENTITY_ID);

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        samlConfig);
  }

  @Test
  void validateIdpCertificateAgainstConfigAllowsAuth0CustomDomains() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("CN=login.example.com"));

    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig.getIdp().setEntityId("urn:dev-tenant.us.auth0.com");

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        samlConfig);
  }

  @Test
  void validateIdpCertificateAgainstConfigAllowsNonMicrosoftAzureCertificates() throws Exception {
    X509Certificate cert = mock(X509Certificate.class);
    when(cert.getSubjectDN()).thenReturn(new X500Principal("CN=generic.example.com"));

    SamlSSOClientConfig samlConfig = baseConfig("http://localhost/unused");
    samlConfig
        .getIdp()
        .setEntityId("https://sts.windows.net/11111111-2222-3333-4444-555555555555/");

    invokePrivate(
        "validateIdpCertificateAgainstConfig",
        new Class<?>[] {X509Certificate.class, SamlSSOClientConfig.class},
        cert,
        samlConfig);
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

  /**
   * The test key in PKCS#1 form ({@code BEGIN RSA PRIVATE KEY}), as OpenSSL 1.x {@code genrsa}
   * writes it. A 2048-bit PKCS#8 RSA key is a 26-byte PrivateKeyInfo header followed by the PKCS#1
   * RSAPrivateKey.
   */
  private static String pkcs1PrivateKey() {
    String base64 =
        GENERIC_PRIVATE_KEY
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
    byte[] pkcs8 = Base64.getDecoder().decode(base64);
    byte[] pkcs1 = Arrays.copyOfRange(pkcs8, 26, pkcs8.length);
    return "-----BEGIN RSA PRIVATE KEY-----\n"
        + Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(pkcs1)
        + "\n-----END RSA PRIVATE KEY-----\n";
  }

  private static void respond(HttpExchange exchange, int statusCode, String body)
      throws IOException {
    byte[] payload = body.getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(statusCode, payload.length == 0 ? -1 : payload.length);
    try (OutputStream responseBody = exchange.getResponseBody()) {
      responseBody.write(payload);
    }
  }

  private record TestSsoServer(HttpServer server, String url) implements AutoCloseable {
    static TestSsoServer start(int statusCode, String body) throws IOException {
      return start(exchange -> respond(exchange, statusCode, body));
    }

    static TestSsoServer start(HttpHandler handler) throws IOException {
      HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
      server.createContext("/sso", handler);
      server.start();
      return new TestSsoServer(
          server, "http://localhost:" + server.getAddress().getPort() + "/sso");
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }

  /**
   * An identity provider that, like a Microsoft Entra application with "Require verification
   * certificates" on, accepts a sign-in request only when it carries a valid HTTP-Redirect binding
   * signature by the SP key, and otherwise answers with Entra's AADSTS76021 error page.
   */
  private static final class SigningIdp implements AutoCloseable {
    private final AtomicBoolean acceptedSignedRequest = new AtomicBoolean();
    private final TestSsoServer server;

    private SigningIdp() throws IOException {
      server = TestSsoServer.start(this::handle);
    }

    static SigningIdp start() throws IOException {
      return new SigningIdp();
    }

    String url() {
      return server.url();
    }

    boolean acceptedSignedRequest() {
      return acceptedSignedRequest.get();
    }

    private void handle(HttpExchange exchange) throws IOException {
      boolean signed = isSignedBySpKey(exchange.getRequestURI().getRawQuery());
      acceptedSignedRequest.compareAndSet(false, signed);
      respond(
          exchange,
          signed ? 200 : 400,
          signed ? "Sign in to your account" : IdpErrorResponseTest.ENTRA_UNSIGNED_REQUEST_PAGE);
    }

    /** SAML 2.0 bindings §3.4.4.1: the signature covers the parameters exactly as encoded. */
    private static boolean isSignedBySpKey(String rawQuery) {
      Map<String, String> parameters = new HashMap<>();
      for (String parameter : rawQuery.split("&")) {
        String[] nameAndValue = parameter.split("=", 2);
        parameters.put(nameAndValue[0], nameAndValue.length > 1 ? nameAndValue[1] : "");
      }
      if (!parameters.containsKey("Signature")) {
        return false;
      }
      String signedContent =
          "SAMLRequest="
              + parameters.get("SAMLRequest")
              + (parameters.containsKey("RelayState")
                  ? "&RelayState=" + parameters.get("RelayState")
                  : "")
              + "&SigAlg="
              + parameters.get("SigAlg");
      try {
        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(spCertificate().getPublicKey());
        verifier.update(signedContent.getBytes(StandardCharsets.UTF_8));
        return verifier.verify(
            Base64.getDecoder()
                .decode(URLDecoder.decode(parameters.get("Signature"), StandardCharsets.UTF_8)));
      } catch (GeneralSecurityException e) {
        return false;
      }
    }

    private static X509Certificate spCertificate() throws CertificateException {
      return (X509Certificate)
          CertificateFactory.getInstance("X.509")
              .generateCertificate(
                  new ByteArrayInputStream(GENERIC_CERT.getBytes(StandardCharsets.US_ASCII)));
    }

    @Override
    public void close() {
      server.close();
    }
  }

  private static final class TrackingInputStream extends InputStream {
    private final byte[] data;
    private int index;
    private boolean closed;

    private TrackingInputStream(byte[] data) {
      this.data = data;
    }

    @Override
    public int read() {
      if (index >= data.length) {
        return -1;
      }
      return data[index++];
    }

    @Override
    public int read(byte[] buffer, int offset, int length) {
      if (index >= data.length) {
        return -1;
      }
      int bytesToRead = Math.min(length, data.length - index);
      System.arraycopy(data, index, buffer, offset, bytesToRead);
      index += bytesToRead;
      return bytesToRead;
    }

    @Override
    public void close() {
      closed = true;
    }

    private boolean isClosed() {
      return closed;
    }
  }

  private static final class TrackingHttpURLConnection extends HttpURLConnection {
    private final int responseCode;
    private final TrackingInputStream bodyStream;
    private boolean disconnected;

    private TrackingHttpURLConnection(int responseCode, String body) throws Exception {
      super(new URL("http://localhost"));
      this.responseCode = responseCode;
      bodyStream = new TrackingInputStream(body.getBytes());
    }

    @Override
    public void disconnect() {
      disconnected = true;
    }

    @Override
    public boolean usingProxy() {
      return false;
    }

    @Override
    public void connect() {}

    @Override
    public int getResponseCode() {
      return responseCode;
    }

    @Override
    public InputStream getErrorStream() {
      return bodyStream;
    }

    @Override
    public InputStream getInputStream() throws IOException {
      throw new IOException("not used");
    }

    @Override
    public void setRequestMethod(String method) throws ProtocolException {
      this.method = method;
    }

    private boolean isDisconnected() {
      return disconnected;
    }

    private TrackingInputStream getBodyStream() {
      return bodyStream;
    }
  }
}
