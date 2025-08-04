package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.ByteArrayInputStream;
import java.net.URL;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.system.ValidationResult;

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

      return new ValidationResult()
          .withComponent("saml")
          .withStatus("success")
          .withMessage(
              "SAML configuration validated successfully. Configuration is valid and certificates are valid.");
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
      // Clean certificate data
      String cleanCertData = certData.replaceAll("\\s+", "");

      // Decode base64 certificate
      byte[] certBytes = Base64.getDecoder().decode(cleanCertData);

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
}
