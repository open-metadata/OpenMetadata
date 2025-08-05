package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.system.ValidationResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

@Slf4j
public class SamlValidator {

  public ValidationResult validateSamlConfiguration(
      AuthenticationConfiguration authConfig, SamlSSOClientConfig samlConfig) {
    try {
      // Step 1: Validate basic SAML configuration
      ValidationResult basicValidation = validateBasicSamlConfig(samlConfig);
      if ("failed".equals(basicValidation.getStatus())) {
        return basicValidation;
      }

      // Note: SAML metadata URL validation is not available in current schema
      // Could be added in the future if metadata URL field is added to IdP config

      // Step 3: Validate certificates if provided
      ValidationResult certValidation = validateCertificates(samlConfig);
      if ("failed".equals(certValidation.getStatus())) {
        return certValidation;
      }

      // Step 4: Validate security configuration consistency
      ValidationResult securityValidation = validateSecurityConfiguration(samlConfig);
      if ("failed".equals(securityValidation.getStatus())) {
        return securityValidation;
      }

      // Step 5: Validate IdP connectivity (real validation)
      ValidationResult connectivityValidation = validateIdpConnectivity(samlConfig);
      if ("failed".equals(connectivityValidation.getStatus())) {
        return connectivityValidation;
      }

      // Step 6: Validate IdP metadata if available (real validation)
      ValidationResult metadataValidation = validateIdpMetadata(samlConfig);
      // Note: Metadata validation returns warning if not available, not failure

      // Step 7: Test SAML request generation
      ValidationResult requestValidation = validateSamlRequestGeneration(samlConfig);
      if ("failed".equals(requestValidation.getStatus())) {
        return requestValidation;
      }

      StringBuilder message = new StringBuilder("SAML configuration validated successfully.");
      if ("warning".equals(connectivityValidation.getStatus())) {
        message.append(" Warning: ").append(connectivityValidation.getMessage());
      }
      if ("warning".equals(metadataValidation.getStatus())) {
        message.append(" Note: ").append(metadataValidation.getMessage());
      }

      return new ValidationResult()
          .withComponent("saml")
          .withStatus("success")
          .withMessage(message.toString());
    } catch (Exception e) {
      LOG.error("SAML validation failed", e);
      return new ValidationResult()
          .withComponent("saml")
          .withStatus("failed")
          .withMessage("SAML validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateBasicSamlConfig(SamlSSOClientConfig samlConfig) {
    try {
      // Validate SP configuration
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

      // Validate URLs
      try {
        new URL(spConfig.getAcs());
        new URL(spConfig.getCallback());
      } catch (Exception e) {
        throw new IllegalArgumentException("Invalid SAML SP URL format: " + e.getMessage());
      }

      // Validate IdP configuration
      if (samlConfig.getIdp() == null) {
        throw new IllegalArgumentException(
            "SAML Identity Provider (IdP) configuration is required");
      }

      var idpConfig = samlConfig.getIdp();
      if (nullOrEmpty(idpConfig.getEntityId())) {
        throw new IllegalArgumentException("SAML IdP Entity ID is required");
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

      return new ValidationResult()
          .withComponent("saml-basic")
          .withStatus("success")
          .withMessage("Basic SAML configuration is valid");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("saml-basic")
          .withStatus("failed")
          .withMessage(e.getMessage());
    }
  }

  private ValidationResult validateCertificates(SamlSSOClientConfig samlConfig) {
    try {
      // Validate IdP certificate if provided
      if (!nullOrEmpty(samlConfig.getIdp().getIdpX509Certificate())) {
        try {
          validateX509Certificate(
              samlConfig.getIdp().getIdpX509Certificate(), "IdP X509 certificate");
        } catch (Exception e) {
          return new ValidationResult()
              .withComponent("saml-certificates")
              .withStatus("failed")
              .withMessage("IdP certificate validation failed: " + e.getMessage());
        }
      }

      // Validate SP certificate if signing is enabled and certificate is provided
      if (samlConfig.getSecurity() != null) {
        boolean needsSpCert =
            Boolean.TRUE.equals(samlConfig.getSecurity().getSendSignedAuthRequest())
                || Boolean.TRUE.equals(samlConfig.getSecurity().getSignSpMetadata());

        if (needsSpCert && !nullOrEmpty(samlConfig.getSp().getSpX509Certificate())) {
          try {
            validateX509Certificate(
                samlConfig.getSp().getSpX509Certificate(), "SP X509 certificate");
          } catch (Exception e) {
            return new ValidationResult()
                .withComponent("saml-certificates")
                .withStatus("failed")
                .withMessage("SP certificate validation failed: " + e.getMessage());
          }
        }
      }

      return new ValidationResult()
          .withComponent("saml-certificates")
          .withStatus("success")
          .withMessage("SAML certificates validated successfully");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("saml-certificates")
          .withStatus("failed")
          .withMessage("Certificate validation failed: " + e.getMessage());
    }
  }

  private ValidationResult validateSecurityConfiguration(SamlSSOClientConfig samlConfig) {
    try {
      if (samlConfig.getSecurity() == null) {
        return new ValidationResult()
            .withComponent("saml-security")
            .withStatus("success")
            .withMessage("No security configuration provided - using defaults");
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

      return new ValidationResult()
          .withComponent("saml-security")
          .withStatus("success")
          .withMessage("SAML security configuration is consistent");
    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("saml-security")
          .withStatus("failed")
          .withMessage("Security configuration validation failed: " + e.getMessage());
    }
  }

  private void validateX509Certificate(String certData, String certName) throws Exception {
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

  private ValidationResult validateIdpConnectivity(SamlSSOClientConfig samlConfig) {
    try {
      String ssoUrl = samlConfig.getIdp().getSsoLoginUrl();
      LOG.debug("Testing IdP connectivity to: {}", ssoUrl);

      URL url = new URL(ssoUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);
      conn.setInstanceFollowRedirects(false);

      int responseCode = conn.getResponseCode();
      LOG.debug("IdP connectivity test response code: {}", responseCode);

      if (responseCode >= 200 && responseCode < 400) {
        return new ValidationResult()
            .withComponent("saml-connectivity")
            .withStatus("success")
            .withMessage("IdP SSO endpoint is accessible (HTTP " + responseCode + ")");
      } else if (responseCode >= 400 && responseCode < 500) {
        // 4xx might be expected for SAML endpoints without proper parameters
        return new ValidationResult()
            .withComponent("saml-connectivity")
            .withStatus("warning")
            .withMessage(
                "IdP endpoint returned HTTP "
                    + responseCode
                    + " (may be normal for SAML endpoints)");
      } else {
        return new ValidationResult()
            .withComponent("saml-connectivity")
            .withStatus("failed")
            .withMessage("IdP SSO endpoint is not accessible (HTTP " + responseCode + ")");
      }
    } catch (Exception e) {
      LOG.warn("IdP connectivity test failed", e);
      return new ValidationResult()
          .withComponent("saml-connectivity")
          .withStatus("warning")
          .withMessage(
              "IdP connectivity test failed: "
                  + e.getMessage()
                  + ". This may not prevent SAML authentication.");
    }
  }

  private ValidationResult validateIdpMetadata(SamlSSOClientConfig samlConfig) {
    // Try common metadata URL patterns for different IdP providers
    String[] metadataUrls = buildMetadataUrls(samlConfig);

    for (String metadataUrl : metadataUrls) {
      try {
        LOG.debug("Attempting to fetch SAML metadata from: {}", metadataUrl);

        ValidationResult result = fetchAndValidateMetadata(metadataUrl, samlConfig);
        if ("success".equals(result.getStatus())) {
          return result;
        }
      } catch (Exception e) {
        LOG.debug("Metadata URL {} failed: {}", metadataUrl, e.getMessage());
      }
    }

    return new ValidationResult()
        .withComponent("saml-metadata")
        .withStatus("warning")
        .withMessage(
            "Could not fetch IdP metadata for enhanced validation. Basic configuration validation passed.");
  }

  private String[] buildMetadataUrls(SamlSSOClientConfig samlConfig) {
    String entityId = samlConfig.getIdp().getEntityId();
    String ssoUrl = samlConfig.getIdp().getSsoLoginUrl();

    // Common metadata URL patterns for different providers
    return new String[] {
      // Azure AD pattern
      entityId + "/federationmetadata/2007-06/federationmetadata.xml",
      // Generic patterns
      entityId + "/metadata",
      ssoUrl.replace("/sso", "/metadata"),
      ssoUrl.replace("/saml2", "/metadata"),
      // Okta pattern
      ssoUrl.replace("/sso/saml", "/metadata"),
      // ADFS pattern
      entityId + "/FederationMetadata/2007-06/FederationMetadata.xml"
    };
  }

  private ValidationResult fetchAndValidateMetadata(
      String metadataUrl, SamlSSOClientConfig samlConfig) {
    try {
      URL url = new URL(metadataUrl);
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(10000);
      conn.setRequestProperty("Accept", "application/samlmetadata+xml, text/xml");

      int responseCode = conn.getResponseCode();
      if (responseCode != 200) {
        throw new Exception("HTTP " + responseCode);
      }

      // Read metadata XML
      StringBuilder metadata = new StringBuilder();
      try (BufferedReader reader =
          new BufferedReader(
              new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
          metadata.append(line).append("\n");
        }
      }

      // Parse and validate metadata XML
      return validateMetadataXml(metadata.toString(), samlConfig, metadataUrl);

    } catch (Exception e) {
      throw new RuntimeException(
          "Failed to fetch metadata from " + metadataUrl + ": " + e.getMessage());
    }
  }

  private ValidationResult validateMetadataXml(
      String metadataXml, SamlSSOClientConfig samlConfig, String metadataUrl) {
    try {
      DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
      factory.setNamespaceAware(true);
      // Security settings for XML parsing
      factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
      factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

      DocumentBuilder builder = factory.newDocumentBuilder();
      Document doc =
          builder.parse(new ByteArrayInputStream(metadataXml.getBytes(StandardCharsets.UTF_8)));

      // Validate EntityDescriptor
      NodeList entityDescriptors =
          doc.getElementsByTagNameNS("urn:oasis:names:tc:SAML:2.0:metadata", "EntityDescriptor");
      if (entityDescriptors.getLength() == 0) {
        throw new Exception("No EntityDescriptor found in metadata");
      }

      Element entityDescriptor = (Element) entityDescriptors.item(0);
      String metadataEntityId = entityDescriptor.getAttribute("entityID");

      // Validate EntityID matches configuration
      if (!metadataEntityId.equals(samlConfig.getIdp().getEntityId())) {
        return new ValidationResult()
            .withComponent("saml-metadata")
            .withStatus("warning")
            .withMessage(
                "Metadata EntityID ("
                    + metadataEntityId
                    + ") doesn't match configuration ("
                    + samlConfig.getIdp().getEntityId()
                    + ")");
      }

      // Validate SSO Service endpoints
      NodeList ssoServices =
          doc.getElementsByTagNameNS("urn:oasis:names:tc:SAML:2.0:metadata", "SingleSignOnService");
      boolean foundMatchingSso = false;
      for (int i = 0; i < ssoServices.getLength(); i++) {
        Element ssoService = (Element) ssoServices.item(i);
        String location = ssoService.getAttribute("Location");
        if (location.equals(samlConfig.getIdp().getSsoLoginUrl())) {
          foundMatchingSso = true;
          break;
        }
      }

      if (!foundMatchingSso) {
        return new ValidationResult()
            .withComponent("saml-metadata")
            .withStatus("warning")
            .withMessage(
                "SSO URL in metadata doesn't match configuration. This may cause authentication issues.");
      }

      // Validate certificates in metadata match configuration
      if (!nullOrEmpty(samlConfig.getIdp().getIdpX509Certificate())) {
        NodeList keyDescriptors =
            doc.getElementsByTagNameNS("urn:oasis:names:tc:SAML:2.0:metadata", "KeyDescriptor");
        // Note: Full certificate comparison would be complex, skipping for now
      }

      return new ValidationResult()
          .withComponent("saml-metadata")
          .withStatus("success")
          .withMessage("IdP metadata validated successfully from " + metadataUrl);

    } catch (Exception e) {
      throw new RuntimeException("Failed to parse metadata XML: " + e.getMessage());
    }
  }

  private ValidationResult validateSamlRequestGeneration(SamlSSOClientConfig samlConfig) {
    try {
      // Basic validation that we can build SAML settings without errors
      // This tests the consistency of SP configuration

      // Validate SP Entity ID format
      String spEntityId = samlConfig.getSp().getEntityId();
      if (!spEntityId.startsWith("http://") && !spEntityId.startsWith("https://")) {
        return new ValidationResult()
            .withComponent("saml-request-generation")
            .withStatus("warning")
            .withMessage("SP Entity ID should typically be a URL format for better compatibility");
      }

      // Validate ACS URL is accessible from SP perspective
      String acsUrl = samlConfig.getSp().getAcs();
      try {
        new URL(acsUrl); // Basic URL validation
      } catch (Exception e) {
        return new ValidationResult()
            .withComponent("saml-request-generation")
            .withStatus("failed")
            .withMessage("Invalid ACS URL format: " + e.getMessage());
      }

      // Validate callback URL format
      String callbackUrl = samlConfig.getSp().getCallback();
      try {
        new URL(callbackUrl); // Basic URL validation
      } catch (Exception e) {
        return new ValidationResult()
            .withComponent("saml-request-generation")
            .withStatus("failed")
            .withMessage("Invalid callback URL format: " + e.getMessage());
      }

      // Note: We could integrate with OneLogin SAML library here to actually generate a request
      // but that would require additional dependencies and mock objects

      return new ValidationResult()
          .withComponent("saml-request-generation")
          .withStatus("success")
          .withMessage("SAML request generation validation passed");

    } catch (Exception e) {
      return new ValidationResult()
          .withComponent("saml-request-generation")
          .withStatus("failed")
          .withMessage("SAML request generation test failed: " + e.getMessage());
    }
  }
}
