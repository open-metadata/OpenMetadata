package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.ByteArrayInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationHttpUtil;

@Slf4j
public class SamlValidator {

  public FieldError validateSamlConfiguration(
      AuthenticationConfiguration authConfig, SamlSSOClientConfig samlConfig) {
    try {
      FieldError basicValidation = validateBasicSamlConfig(samlConfig);
      if (basicValidation != null) {
        return basicValidation;
      }

      FieldError certValidation = validateCertificates(samlConfig);
      if (certValidation != null) {
        return certValidation;
      }

      FieldError securityValidation = validateSecurityConfiguration(samlConfig);
      if (securityValidation != null) {
        return securityValidation;
      }

      FieldError idpValidation = validateIdpConnectivity(samlConfig);
      if (idpValidation != null) {
        return idpValidation;
      }

      return null; // Success - SAML configuration validated
    } catch (Exception e) {
      LOG.error("SAML validation failed", e);
      return ValidationErrorBuilder.createFieldError(
          "authenticationConfiguration", "SAML validation failed: " + e.getMessage());
    }
  }

  private FieldError validateBasicSamlConfig(SamlSSOClientConfig samlConfig) {
    try {
      if (samlConfig.getSp() == null) {
        throw new IllegalArgumentException("SAML Service Provider (SP) configuration is required");
      }

      var spConfig = samlConfig.getSp();
      if (nullOrEmpty(spConfig.getEntityId())) {
        throw new IllegalArgumentException("SAML SP Entity ID is required");
      }

      if (nullOrEmpty(spConfig.getAcs())) {
        throw new IllegalArgumentException(
            "SAML SP Assertion Consumer Service (ACS) URL is required");
      }

      if (nullOrEmpty(spConfig.getCallback())) {
        throw new IllegalArgumentException("SAML SP callback URL is required");
      }

      try {
        URL acsUrl = new URL(spConfig.getAcs());
        String path = acsUrl.getPath();
        if (!path.endsWith("/api/v1/saml/acs") && !path.endsWith("/callback")) {
          throw new IllegalArgumentException(
              "ACS URL must end with '/api/v1/saml/acs' or '/callback'. Current path: " + path);
        }
      } catch (Exception e) {
        if (e instanceof IllegalArgumentException) {
          throw e;
        }
        throw new IllegalArgumentException("Invalid ACS URL format: " + e.getMessage());
      }

      try {
        new URL(spConfig.getCallback());
      } catch (Exception e) {
        throw new IllegalArgumentException("Invalid callback URL format: " + e.getMessage());
      }

      if (samlConfig.getIdp() == null) {
        throw new IllegalArgumentException(
            "SAML Identity Provider (IdP) configuration is required");
      }

      var idpConfig = samlConfig.getIdp();
      if (nullOrEmpty(idpConfig.getEntityId())) {
        throw new IllegalArgumentException("SAML IdP Entity ID is required");
      }

      // IdP X509 certificate is REQUIRED for signature verification
      if (nullOrEmpty(idpConfig.getIdpX509Certificate())) {
        throw new IllegalArgumentException(
            "SAML IdP X509 Certificate is required for verifying SAML response signatures");
      }

      // Validate IdP Entity ID format and verify with actual endpoints
      try {
        // For Azure AD, entity ID should be a valid URL like https://sts.windows.net/{tenant-id}/
        // For other providers, it could be a URL or URN
        String entityId = idpConfig.getEntityId();
        if (entityId.startsWith("http://") || entityId.startsWith("https://")) {
          new URL(entityId); // Validate URL format

          // Special validation for Azure AD with real tenant validation
          if (entityId.contains("sts.windows.net")
              || entityId.contains("login.microsoftonline.com")) {
            FieldError azureValidation =
                validateAzureAdTenant(entityId, idpConfig.getSsoLoginUrl());
            if (azureValidation != null) {
              return azureValidation;
            }
          } else if (entityId.contains(".okta.com")) {
            // Okta entity ID validation
            if (!entityId.matches("http[s]?://www\\.okta\\.com/[a-zA-Z0-9]+")) {
              throw new IllegalArgumentException(
                  "Okta Entity ID should be in format: http://www.okta.com/{app-id}");
            }
          } else if (entityId.contains(".auth0.com")) {
            // Auth0 entity ID validation - Auth0 supports both URL and URN formats
            // Valid formats:
            // - https://dev-tenant.us.auth0.com
            // - urn:dev-tenant.us.auth0.com
            // Both are valid, no additional validation needed beyond the URL check above
          }
        } else if (!entityId.startsWith("urn:")) {
          // If not a URL, should at least be a URN or some identifier
          throw new IllegalArgumentException(
              "IdP Entity ID should be a valid URL or URN. Got: " + entityId);
        }
      } catch (Exception e) {
        if (e instanceof IllegalArgumentException) {
          throw e;
        }
        throw new IllegalArgumentException("Invalid IdP Entity ID format: " + e.getMessage());
      }

      FieldError nameIdValidation = validateNameIdFormatWithIdp(idpConfig);
      if (nameIdValidation != null) {
        throw new IllegalArgumentException(nameIdValidation.getError());
      }

      if (nullOrEmpty(idpConfig.getSsoLoginUrl())) {
        throw new IllegalArgumentException("SAML IdP SSO Login URL is required");
      }

      // Validate SSO Login URL
      try {
        new URL(idpConfig.getSsoLoginUrl());
      } catch (Exception e) {
        throw new IllegalArgumentException("Invalid SAML IdP SSO Login URL: " + e.getMessage());
      }

      return null; // Success - Basic SAML configuration is valid
    } catch (Exception e) {
      // Map specific errors to appropriate fields
      String message = e.getMessage();
      if (message.contains("SP Entity ID")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_SP_ENTITY_ID, message);
      } else if (message.contains("ACS") || message.contains("Assertion Consumer")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_SP_ACS_URL, message);
      } else if (message.contains("callback")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_SP_CALLBACK, message);
      } else if (message.contains("IdP Entity ID")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID, message);
      } else if (message.contains("IdP X509 Certificate")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_CERT, message);
      } else if (message.contains("SSO Login URL")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL, message);
      } else {
        return ValidationErrorBuilder.createFieldError("", message);
      }
    }
  }

  private FieldError validateCertificates(SamlSSOClientConfig samlConfig) {
    try {
      // Validate IdP certificate if provided
      if (!nullOrEmpty(samlConfig.getIdp().getIdpX509Certificate())) {
        try {
          validateX509Certificate(
              samlConfig.getIdp().getIdpX509Certificate(), "IdP X509 certificate", samlConfig);
        } catch (Exception e) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.SAML_IDP_CERT,
              "IdP certificate validation failed: " + e.getMessage());
        }
      }

      if (samlConfig.getSecurity() != null) {
        boolean needsSpCert =
            Boolean.TRUE.equals(samlConfig.getSecurity().getSendSignedAuthRequest())
                || Boolean.TRUE.equals(samlConfig.getSecurity().getSignSpMetadata());

        if (needsSpCert && !nullOrEmpty(samlConfig.getSp().getSpX509Certificate())) {
          try {
            validateX509Certificate(
                samlConfig.getSp().getSpX509Certificate(), "SP X509 certificate");
          } catch (Exception e) {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.SAML_SP_CERT,
                "SP certificate validation failed: " + e.getMessage());
          }
        }
      }

      return null; // Success - SAML certificates validated
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          "", "Certificate validation failed: " + e.getMessage());
    }
  }

  private FieldError validateSecurityConfiguration(SamlSSOClientConfig samlConfig) {
    try {
      if (samlConfig.getSecurity() == null) {
        return null; // Success - No security configuration provided, using defaults
      }

      var security = samlConfig.getSecurity();

      // Check certificate requirements based on security settings
      if (Boolean.TRUE.equals(security.getWantMessagesSigned())
          || Boolean.TRUE.equals(security.getWantAssertionsSigned())) {
        if (nullOrEmpty(samlConfig.getIdp().getIdpX509Certificate())) {
          throw new IllegalArgumentException(
              "IdP X509 certificate is required when signature validation is enabled");
        }
      }

      if (Boolean.TRUE.equals(security.getSendSignedAuthRequest())
          || Boolean.TRUE.equals(security.getSignSpMetadata())) {
        if (nullOrEmpty(samlConfig.getSp().getSpX509Certificate())) {
          throw new IllegalArgumentException(
              "SP X509 certificate is required when request signing is enabled");
        }
        if (nullOrEmpty(samlConfig.getSp().getSpPrivateKey())) {
          throw new IllegalArgumentException(
              "SP private key is required when request signing is enabled");
        }
      }

      return null; // Success - SAML security configuration is consistent
    } catch (Exception e) {
      String message = e.getMessage();
      if (message.contains("IdP X509 certificate")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_CERT, message);
      } else if (message.contains("SP X509 certificate")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_SP_CERT, message);
      } else if (message.contains("SP private key")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_SP_KEY, message);
      } else {
        return ValidationErrorBuilder.createFieldError(
            "", "Security configuration validation failed: " + message);
      }
    }
  }

  private FieldError validateIdpConnectivity(SamlSSOClientConfig samlConfig) {
    try {
      String ssoUrl = samlConfig.getIdp().getSsoLoginUrl();
      LOG.debug("Testing IdP SSO URL with SAML request: {}", ssoUrl);

      // Create a minimal SAML request to test the SSO URL
      String samlRequest = createTestSamlRequest(samlConfig);

      // Build URL with SAML request parameter (HTTP-Redirect binding)
      StringBuilder urlWithParams = new StringBuilder(ssoUrl);
      urlWithParams.append(ssoUrl.contains("?") ? "&" : "?");
      urlWithParams.append("SAMLRequest=").append(samlRequest);

      URL url = new URL(urlWithParams.toString());
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);
      conn.setInstanceFollowRedirects(false);
      int responseCode = conn.getResponseCode();
      LOG.debug("IdP response code to SAML request: {}", responseCode);

      // Analyze response
      if (responseCode == 404) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL,
            "SSO Login URL not found (HTTP 404). The URL '" + ssoUrl + "' does not exist.");
      } else if (responseCode == 405) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL,
            "SSO URL doesn't accept GET requests (HTTP 405). Please check the SSO URL configuration.");
      } else if (responseCode >= 200 && responseCode < 400) {
        // 200 or 302 means the IdP accepted our SAML request
        return null; // Success - SSO Login URL validated
      } else if (responseCode >= 400 && responseCode < 500) {
        // 400-499 could mean wrong URL or IdP rejecting the request
        // Read a bit of the response to check for specific errors
        String responseSnippet = readResponseSnippet(conn);
        if (responseSnippet.toLowerCase().contains("saml")
            || responseSnippet.toLowerCase().contains("invalid")) {
          // Warning case - treat as success
          LOG.warn(
              "SSO URL responded with client error (HTTP {}). This might be due to the test SAML request format.",
              responseCode);
          return null;
        }
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL,
            "SSO URL returned error (HTTP "
                + responseCode
                + "). Please verify the URL is correct.");
      } else {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_SSO_URL,
            "SSO URL is not accessible (HTTP " + responseCode + ")");
      }
    } catch (Exception e) {
      LOG.warn("SSO URL validation failed", e);
      // Warning case - treat as success since URL format might be valid
      LOG.warn("SSO URL validation warning: {}", e.getMessage());
      return null;
    }
  }

  private String createTestSamlRequest(SamlSSOClientConfig samlConfig) {
    try {
      // Create a minimal SAML AuthnRequest XML
      String timestamp =
          java.time.Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString();
      String requestId = "_" + java.util.UUID.randomUUID().toString();

      String samlRequestXml =
          "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
              + "<samlp:AuthnRequest xmlns:samlp=\"urn:oasis:names:tc:SAML:2.0:protocol\" "
              + "xmlns:saml=\"urn:oasis:names:tc:SAML:2.0:assertion\" "
              + "ID=\""
              + requestId
              + "\" "
              + "Version=\"2.0\" "
              + "IssueInstant=\""
              + timestamp
              + "\" "
              + "Destination=\""
              + samlConfig.getIdp().getSsoLoginUrl()
              + "\" "
              + "AssertionConsumerServiceURL=\""
              + samlConfig.getSp().getAcs()
              + "\">"
              + "<saml:Issuer>"
              + samlConfig.getSp().getEntityId()
              + "</saml:Issuer>"
              + "</samlp:AuthnRequest>";

      // Compress (deflate) the request
      java.io.ByteArrayOutputStream bytesOut = new java.io.ByteArrayOutputStream();
      java.util.zip.Deflater deflater =
          new java.util.zip.Deflater(java.util.zip.Deflater.DEFLATED, true);
      java.util.zip.DeflaterOutputStream deflaterStream =
          new java.util.zip.DeflaterOutputStream(bytesOut, deflater);
      deflaterStream.write(samlRequestXml.getBytes("UTF-8"));
      deflaterStream.finish();

      // Base64 encode
      String base64Request = Base64.getEncoder().encodeToString(bytesOut.toByteArray());

      // URL encode for use in query parameter
      return java.net.URLEncoder.encode(base64Request, "UTF-8");
    } catch (Exception e) {
      LOG.warn("Failed to create test SAML request", e);
      // Return a dummy encoded string if we can't create proper request
      return "dGVzdA==";
    }
  }

  private String readResponseSnippet(HttpURLConnection conn) {
    try {
      java.io.InputStream inputStream = conn.getErrorStream();
      if (inputStream == null) {
        inputStream = conn.getInputStream();
      }
      if (inputStream != null) {
        byte[] buffer = new byte[500];
        int bytesRead = inputStream.read(buffer);
        if (bytesRead > 0) {
          return new String(buffer, 0, bytesRead, "UTF-8");
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not read response", e);
    }
    return "";
  }

  private void validateX509Certificate(String certData, String certName) throws Exception {
    validateX509Certificate(certData, certName, null);
  }

  private void validateX509Certificate(
      String certData, String certName, SamlSSOClientConfig samlConfig) throws Exception {
    try {
      // Extract base64 content from PEM format
      String base64Content =
          certData
              .replace("-----BEGIN CERTIFICATE-----", "")
              .replace("-----END CERTIFICATE-----", "")
              .replace("-----BEGIN PUBLIC KEY-----", "")
              .replace("-----END PUBLIC KEY-----", "")
              .replaceAll("\\s+", "");

      if (base64Content.isEmpty()) {
        throw new IllegalArgumentException("Certificate data is empty after removing PEM headers");
      }

      // Decode base64 certificate
      byte[] certBytes = Base64.getDecoder().decode(base64Content);

      // Parse certificate
      CertificateFactory cf = CertificateFactory.getInstance("X.509");
      X509Certificate cert =
          (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(certBytes));

      // Check if certificate is expired
      Date now = Date.from(Instant.now());
      Date notAfter = cert.getNotAfter();
      Date notBefore = cert.getNotBefore();

      if (now.before(notBefore)) {
        throw new CertificateException(certName + " is not yet valid. Valid from: " + notBefore);
      }

      if (now.after(notAfter)) {
        throw new CertificateException(certName + " has expired. Expired on: " + notAfter);
      }

      // Warn if certificate expires soon (within 30 days)
      long daysUntilExpiry = (notAfter.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      if (daysUntilExpiry <= 30) {
        LOG.warn(
            "SAML {} expires in {} days ({}). Consider renewing soon.",
            certName,
            daysUntilExpiry,
            notAfter);
      }

      // Perform IdP-specific validation if this is an IdP certificate
      if (samlConfig != null && certName.contains("IdP")) {
        validateIdpCertificateAgainstConfig(cert, samlConfig);
      }

      LOG.debug(
          "SAML {} validated successfully. Subject: {}, Valid until: {}",
          certName,
          cert.getSubjectDN(),
          notAfter);

    } catch (Exception e) {
      if (e instanceof CertificateException) {
        throw e;
      }
      throw new CertificateException("Failed to parse " + certName + ": " + e.getMessage(), e);
    }
  }

  private void validateIdpCertificateAgainstConfig(
      X509Certificate cert, SamlSSOClientConfig samlConfig) throws CertificateException {
    try {
      String subjectDN = cert.getSubjectDN().toString();

      // Extract CN from certificate subject
      String certCN = extractCNFromDN(subjectDN);
      if (certCN == null || certCN.isEmpty()) {
        LOG.warn("Certificate does not have a Common Name (CN) in subject");
        return;
      }

      LOG.info("Validating certificate CN '{}' against IdP configuration", certCN);

      // Extract domains from IdP configuration
      String idpEntityId = samlConfig.getIdp().getEntityId();
      String ssoLoginUrl = samlConfig.getIdp().getSsoLoginUrl();

      // Extract domain from Entity ID for comparison
      String entityIdDomain = null;
      if (idpEntityId != null && !idpEntityId.isEmpty()) {
        entityIdDomain = extractDomainFromUrl(idpEntityId);
        LOG.info("Extracted domain '{}' from Entity ID '{}'", entityIdDomain, idpEntityId);
      }

      // SIMPLE AUTH0 VALIDATION: Certificate CN must match the Entity ID domain exactly
      if (entityIdDomain != null && entityIdDomain.contains(".auth0.com")) {
        // This is Auth0 configuration - certificate CN MUST match the tenant domain
        if (!certCN.equals(entityIdDomain)) {
          throw new CertificateException(
              "Auth0 certificate validation failed. Certificate CN '"
                  + certCN
                  + "' does not match Entity ID domain '"
                  + entityIdDomain
                  + "'. Auth0 requires exact tenant match.");
        }
        LOG.info("Auth0 certificate validation passed - CN matches Entity ID domain");
        return; // Valid Auth0 certificate, no need for further checks
      }

      // OKTA VALIDATION: Similar to Auth0
      if (entityIdDomain != null && entityIdDomain.contains(".okta.com")) {
        if (!certCN.equals(entityIdDomain) && !certCN.equals("*.okta.com")) {
          throw new CertificateException(
              "Okta certificate validation failed. Certificate CN '"
                  + certCN
                  + "' does not match Entity ID domain '"
                  + entityIdDomain
                  + "'");
        }
        LOG.info("Okta certificate validation passed");
        return;
      }

      // AZURE AD VALIDATION: Must have Microsoft certificate
      if ((idpEntityId != null
              && (idpEntityId.contains("sts.windows.net")
                  || idpEntityId.contains("microsoftonline.com")))
          || (ssoLoginUrl != null && ssoLoginUrl.contains("microsoftonline.com"))) {
        if (!certCN.contains("Microsoft Azure")) {
          throw new CertificateException(
              "Azure AD certificate validation failed. Expected Microsoft Azure certificate but found CN: '"
                  + certCN
                  + "'");
        }
        LOG.info("Azure AD certificate validation passed - Microsoft certificate detected");
        return;
      }

      // REJECT MICROSOFT CERTIFICATE IF NOT AZURE CONFIG
      if (certCN.contains("Microsoft Azure")) {
        throw new CertificateException(
            "Invalid use of Microsoft Azure certificate. This certificate can only be used with Azure AD configurations. "
                + "Current Entity ID: "
                + idpEntityId);
      }

      // For other providers or custom OIDC, warn if CN doesn't match
      if (entityIdDomain != null && !certCN.equals(entityIdDomain)) {
        LOG.warn(
            "Certificate CN '{}' does not match Entity ID domain '{}'. This may cause issues.",
            certCN,
            entityIdDomain);
      }

      // Also check Subject Alternative Names if present
      try {
        java.util.Collection<java.util.List<?>> sanNames = cert.getSubjectAlternativeNames();
        if (sanNames != null && !sanNames.isEmpty()) {
          LOG.debug("Certificate has {} Subject Alternative Names", sanNames.size());
          for (java.util.List<?> san : sanNames) {
            if (san.size() >= 2) {
              Integer type = (Integer) san.get(0);
              String value = san.get(1).toString();
              // Type 2 is DNS name, Type 6 is URI
              if (type == 2 || type == 6) {
                LOG.debug("SAN: {}", value);
                // Check if SAN matches entity ID domain
                if (entityIdDomain != null
                    && !entityIdDomain.isEmpty()
                    && value.contains(entityIdDomain)) {
                  LOG.info("Found matching SAN '{}' for domain '{}'", value, entityIdDomain);
                }
              }
            }
          }
        }
      } catch (Exception e) {
        LOG.debug("Could not check Subject Alternative Names: {}", e.getMessage());
      }

    } catch (CertificateException e) {
      // Re-throw certificate validation failures
      throw e;
    } catch (Exception e) {
      LOG.warn("Could not perform IdP certificate domain validation: {}", e.getMessage());
    }
  }

  private String extractCNFromDN(String dn) {
    try {
      String searchStr = "CN=";
      int startIdx = dn.indexOf(searchStr);
      if (startIdx == -1) {
        return null;
      }
      startIdx += searchStr.length();
      int endIdx = dn.indexOf(",", startIdx);
      if (endIdx == -1) {
        endIdx = dn.length();
      }
      return dn.substring(startIdx, endIdx).trim();
    } catch (Exception e) {
      return null;
    }
  }

  private String extractDomainFromUrl(String url) {
    try {
      // Handle both URL and URN formats
      if (url.startsWith("urn:")) {
        // For URN format like "urn:dev-tenant.us.auth0.com"
        String urnPart = url.substring(4); // Remove "urn:"
        // Extract domain-like part
        if (urnPart.contains(".")) {
          return urnPart;
        }
        return null;
      } else if (url.startsWith("http://") || url.startsWith("https://")) {
        // For URL format
        URL parsedUrl = new URL(url);
        return parsedUrl.getHost();
      } else {
        // Assume it might be a domain directly
        if (url.contains(".")) {
          return url;
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not extract domain from: {}", url);
    }
    return null;
  }

  private FieldError validateAzureAdTenant(String entityId, String ssoLoginUrl) {
    try {
      // Extract tenant ID from entity ID or SSO URL
      String tenantId = null;

      if (entityId.contains("sts.windows.net")) {
        // Format: https://sts.windows.net/{tenant-id}/
        String[] parts = entityId.split("/");
        for (int i = 0; i < parts.length; i++) {
          if (parts[i].equals("sts.windows.net") && i + 1 < parts.length) {
            tenantId = parts[i + 1].replace("/", "");
            break;
          }
        }
      } else if (entityId.contains("login.microsoftonline.com")) {
        // Format: https://login.microsoftonline.com/{tenant-id}/
        String[] parts = entityId.split("/");
        for (int i = 0; i < parts.length; i++) {
          if (parts[i].equals("login.microsoftonline.com") && i + 1 < parts.length) {
            tenantId = parts[i + 1].replace("/", "");
            break;
          }
        }
      }

      // Also check SSO URL for tenant ID if not found in entity ID
      if (tenantId == null
          && ssoLoginUrl != null
          && ssoLoginUrl.contains("login.microsoftonline.com")) {
        String[] parts = ssoLoginUrl.split("/");
        for (int i = 0; i < parts.length; i++) {
          if (parts[i].equals("login.microsoftonline.com") && i + 1 < parts.length) {
            tenantId = parts[i + 1].replace("/", "");
            break;
          }
        }
      }

      if (tenantId == null || tenantId.isEmpty()) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID,
            "Could not extract tenant ID from Entity ID or SSO URL");
      }

      // Validate tenant ID format (should be a GUID)
      if (!tenantId.matches("[a-f0-9\\-]{36}")
          && !tenantId.equals("common")
          && !tenantId.equals("organizations")
          && !tenantId.equals("consumers")) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID,
            "Invalid Azure AD tenant ID format: " + tenantId);
      }

      // Validate tenant exists by checking OpenID configuration
      String openIdConfigUrl =
          "https://login.microsoftonline.com/"
              + tenantId
              + "/v2.0/.well-known/openid-configuration";

      try {
        ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(openIdConfigUrl);

        if (response.getStatusCode() == 200) {
          // Parse response to verify it's a valid OpenID config
          JsonNode config = JsonUtils.readTree(response.getBody());

          // Check if the issuer matches the tenant
          if (config.has("issuer")) {
            String issuer = config.get("issuer").asText();
            if (!issuer.contains(tenantId)
                && !tenantId.equals("common")
                && !tenantId.equals("organizations")
                && !tenantId.equals("consumers")) {
              return ValidationErrorBuilder.createFieldError(
                  ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID,
                  "Tenant ID mismatch. Expected tenant: " + tenantId + " but issuer is: " + issuer);
            }
          }

          return null; // Success - Azure AD tenant validated
        } else if (response.getStatusCode() == 404) {
          return ValidationErrorBuilder.createFieldError(
              ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID,
              "Azure AD tenant not found: "
                  + tenantId
                  + ". Please verify the tenant ID is correct.");
        } else {
          // Warning case - treat as success
          LOG.warn(
              "Could not fully validate Azure AD tenant. HTTP response: {}",
              response.getStatusCode());
          return null;
        }
      } catch (Exception e) {
        LOG.warn("Failed to validate Azure AD tenant", e);
        // Warning case - treat as success
        LOG.warn("Could not validate Azure AD tenant: {}", e.getMessage());
        return null;
      }
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.SAML_IDP_ENTITY_ID,
          "Azure tenant validation failed: " + e.getMessage());
    }
  }

  private FieldError validateNameIdFormatWithIdp(IdentityProviderConfig idpConfig) {
    try {
      if (nullOrEmpty(idpConfig.getNameId())) {
        // NameID is optional, use default if not specified
        return null; // Success - Using default NameID format
      }

      String nameId = idpConfig.getNameId();

      // First check if it's a valid SAML format
      String[] validFormats = {
        "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
        "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
        "urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress",
        "urn:oasis:names:tc:SAML:2.0:nameid-format:unspecified",
        "urn:oasis:names:tc:SAML:2.0:nameid-format:kerberos",
        "urn:oasis:names:tc:SAML:2.0:nameid-format:entity",
        "urn:oasis:names:tc:SAML:2.0:nameid-format:encrypted",
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
        "urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName",
        "urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName"
      };

      boolean isValidFormat = false;
      for (String format : validFormats) {
        if (format.equals(nameId)) {
          isValidFormat = true;
          break;
        }
      }

      if (!isValidFormat) {
        return ValidationErrorBuilder.createFieldError(
            ValidationErrorBuilder.FieldPaths.SAML_IDP_NAME_ID,
            "Invalid NameID format: "
                + nameId
                + ". Must be a valid SAML NameID format URN. Common formats: "
                + "emailAddress, persistent, transient, unspecified");
      }

      // Now validate against IdP's actual supported formats
      if (!nullOrEmpty(idpConfig.getSsoLoginUrl())) {
        // For Azure AD, fetch SAML metadata and validate
        if (idpConfig.getSsoLoginUrl().contains("login.microsoftonline.com")
            || (idpConfig.getEntityId() != null
                && idpConfig.getEntityId().contains("sts.windows.net"))) {

          FieldError azureNameIdValidation = validateAzureNameIdFormat(idpConfig, nameId);
          if (azureNameIdValidation != null) {
            return azureNameIdValidation;
          }
        }
        // Add similar validation for other IdPs if needed
      }

      return null; // Success - NameID format validated

    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.SAML_IDP_NAME_ID,
          "NameID validation failed: " + e.getMessage());
    }
  }

  private FieldError validateAzureNameIdFormat(IdentityProviderConfig idpConfig, String nameId) {
    try {
      // Extract tenant ID
      String tenantId = null;
      if (idpConfig.getEntityId() != null) {
        if (idpConfig.getEntityId().contains("sts.windows.net")) {
          String[] parts = idpConfig.getEntityId().split("/");
          for (int i = 0; i < parts.length; i++) {
            if (parts[i].equals("sts.windows.net") && i + 1 < parts.length) {
              tenantId = parts[i + 1].replace("/", "");
              break;
            }
          }
        }
      }

      if (tenantId == null && idpConfig.getSsoLoginUrl() != null) {
        String[] parts = idpConfig.getSsoLoginUrl().split("/");
        for (int i = 0; i < parts.length; i++) {
          if (parts[i].equals("login.microsoftonline.com") && i + 1 < parts.length) {
            tenantId = parts[i + 1].replace("/", "");
            break;
          }
        }
      }

      if (tenantId == null
          || tenantId.equals("common")
          || tenantId.equals("organizations")
          || tenantId.equals("consumers")) {
        // Can't validate against metadata for multi-tenant endpoints
        LOG.warn("Cannot validate NameID format for multi-tenant Azure AD configuration");
        // Warning case - treat as success for multi-tenant
        LOG.warn("Cannot validate NameID format for multi-tenant Azure AD configuration");
        return null;
      }

      // Fetch SAML metadata from Azure AD
      String metadataUrl =
          "https://login.microsoftonline.com/"
              + tenantId
              + "/FederationMetadata/2007-06/FederationMetadata.xml";

      try {
        ValidationHttpUtil.HttpResponseData response = ValidationHttpUtil.safeGet(metadataUrl);

        if (response.getStatusCode() == 200) {
          String metadata = response.getBody();

          // Azure AD SAML 1.1 supports these NameID formats
          String[] azureSaml11Formats = {
            "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"
          };

          // Azure AD SAML 2.0 supports these NameID formats
          String[] azureSaml20Formats = {
            "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
            "urn:oasis:names:tc:SAML:2.0:nameid-format:transient"
          };

          // Check if metadata contains SAML 2.0 or SAML 1.1 indicators
          boolean supportsSaml20 = metadata.contains("urn:oasis:names:tc:SAML:2.0:protocol");
          boolean supportsSaml11 =
              metadata.contains("urn:oasis:names:tc:SAML:1.1:protocol")
                  || metadata.contains("http://schemas.xmlsoap.org/ws/2005/05/identity");

          // Azure AD typically uses SAML 1.1 emailAddress format for user principal name
          boolean isSupported = false;
          String supportedFormats = "";

          if (supportsSaml11) {
            for (String format : azureSaml11Formats) {
              supportedFormats += format + ", ";
              if (nameId.equals(format)) {
                isSupported = true;
              }
            }
          }

          if (supportsSaml20) {
            for (String format : azureSaml20Formats) {
              supportedFormats += format + ", ";
              if (nameId.equals(format)) {
                isSupported = true;
              }
            }
          }

          // Azure AD most commonly uses SAML 1.1 emailAddress
          if (nameId.equals("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress")) {
            return null; // Success - NameID format is supported by Azure AD
          } else if (nameId.equals("urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress")) {
            // Warning case - treat as success but log warning
            LOG.warn(
                "Azure AD typically uses SAML 1.1 emailAddress format, not SAML 2.0. Configuration may not work correctly.");
            return null;
          } else if (isSupported) {
            return null; // Success - NameID format is supported by Azure AD
          } else {
            return ValidationErrorBuilder.createFieldError(
                ValidationErrorBuilder.FieldPaths.SAML_IDP_NAME_ID,
                "NameID format '"
                    + nameId
                    + "' is not supported by Azure AD. Supported formats: "
                    + supportedFormats);
          }

        } else {
          LOG.warn("Could not fetch Azure AD metadata: HTTP " + response.getStatusCode());
          // Warning case - treat as success
          LOG.warn(
              "Could not verify NameID format against Azure AD metadata: HTTP {}",
              response.getStatusCode());
          return null;
        }
      } catch (Exception e) {
        LOG.warn("Failed to validate NameID against Azure AD metadata", e);
        // Warning case - treat as success
        LOG.warn("Could not verify NameID format: {}", e.getMessage());
        return null;
      }
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError(
          ValidationErrorBuilder.FieldPaths.SAML_IDP_NAME_ID,
          "Azure NameID validation failed: " + e.getMessage());
    }
  }
}
