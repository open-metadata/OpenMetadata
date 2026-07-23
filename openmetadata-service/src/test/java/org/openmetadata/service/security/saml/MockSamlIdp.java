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

import com.onelogin.saml2.util.Constants;
import com.onelogin.saml2.util.Util;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.w3c.dom.Document;

/**
 * Minimal SAML 2.0 Identity Provider test double that mints signed SAML Responses which
 * OpenMetadata's onelogin Service Provider accepts. It is a pure assertion <em>factory</em>: a
 * non-browser integration test drives the ACS POST itself (the cross-site cookie that a real browser
 * would drop is simulated by controlling the cookie jar), so no HTTP server, container, or fixed
 * port is required.
 *
 * <p>Responses are signed with onelogin's own {@link Util#addSign} (RSA-SHA256 / SHA-256), so there
 * is no canonicalization or algorithm mismatch with the validating SP. The key/cert are a static
 * keypair under {@code src/test/resources/saml/}; put {@link #idpCertificatePem()} into the SP's
 * {@code idp.idpX509Certificate} so it trusts these assertions.
 */
public final class MockSamlIdp {
  private static final String SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
  private static final String SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
  private static final String CERT_RESOURCE = "/saml/mock-idp.crt";
  private static final String KEY_RESOURCE = "/saml/mock-idp-pkcs8.key";
  private static final String ID_ATTRIBUTE = "ID";

  private final String idpEntityId;
  private final String certificatePem;
  private final X509Certificate signingCertificate;
  private final PrivateKey signingKey;

  public MockSamlIdp(String idpEntityId) {
    try {
      this.idpEntityId = idpEntityId;
      this.certificatePem = readResource(CERT_RESOURCE);
      this.signingCertificate = Util.loadCert(certificatePem);
      this.signingKey = Util.loadPrivateKey(readResource(KEY_RESOURCE));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to initialize MockSamlIdp", e);
    }
  }

  public String idpEntityId() {
    return idpEntityId;
  }

  /** PEM to place in the SP's {@code idp.idpX509Certificate} so it trusts assertions from here. */
  public String idpCertificatePem() {
    return certificatePem;
  }

  /** A signed, base64 SAML Response for {@code subjectEmail}, ready to POST as {@code SAMLResponse}. */
  public String signedResponse(String subjectEmail, String acsUrl, String spEntityId) {
    String result;
    try {
      Document doc = Util.loadXML(buildResponseXml(subjectEmail, acsUrl, spEntityId));
      // Message-level (Response) signature: addSign signs the document root and returns the whole
      // signed document. onelogin unconditionally requires a valid Response- or Assertion-level
      // signature, so this is sufficient when the SP's want_assertions_signed is left false.
      doc.getDocumentElement().setIdAttribute(ID_ATTRIBUTE, true);
      String signed =
          Util.addSign(doc, signingKey, signingCertificate, Constants.RSA_SHA256, Constants.SHA256);
      result = Util.base64encoder(signed);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to build signed SAML response", e);
    }
    return result;
  }

  /** An unsigned, base64 SAML Response — to assert the SP rejects assertions with no signature. */
  public String unsignedResponse(String subjectEmail, String acsUrl, String spEntityId) {
    String result;
    try {
      result = Util.base64encoder(buildResponseXml(subjectEmail, acsUrl, spEntityId));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to build unsigned SAML response", e);
    }
    return result;
  }

  private String buildResponseXml(String subjectEmail, String acsUrl, String spEntityId) {
    Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    String issueInstant = DateTimeFormatter.ISO_INSTANT.format(now);
    String notBefore = DateTimeFormatter.ISO_INSTANT.format(now.minus(5, ChronoUnit.MINUTES));
    String notOnOrAfter = DateTimeFormatter.ISO_INSTANT.format(now.plus(5, ChronoUnit.MINUTES));
    return """
        <samlp:Response xmlns:samlp="%s" xmlns:saml="%s" ID="%s" Version="2.0" IssueInstant="%s" Destination="%s">
          <saml:Issuer>%s</saml:Issuer>
          <samlp:Status><samlp:StatusCode Value="%s"/></samlp:Status>
          <saml:Assertion ID="%s" Version="2.0" IssueInstant="%s">
            <saml:Issuer>%s</saml:Issuer>
            <saml:Subject>
              <saml:NameID Format="%s">%s</saml:NameID>
              <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
                <saml:SubjectConfirmationData Recipient="%s" NotOnOrAfter="%s"/>
              </saml:SubjectConfirmation>
            </saml:Subject>
            <saml:Conditions NotBefore="%s" NotOnOrAfter="%s">
              <saml:AudienceRestriction><saml:Audience>%s</saml:Audience></saml:AudienceRestriction>
            </saml:Conditions>
            <saml:AuthnStatement AuthnInstant="%s" SessionIndex="%s">
              <saml:AuthnContext>
                <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef>
              </saml:AuthnContext>
            </saml:AuthnStatement>
          </saml:Assertion>
        </samlp:Response>
        """
        .formatted(
            SAML_PROTOCOL_NS,
            SAML_ASSERTION_NS,
            newId(),
            issueInstant,
            acsUrl,
            idpEntityId,
            Constants.STATUS_SUCCESS,
            newId(),
            issueInstant,
            idpEntityId,
            Constants.NAMEID_EMAIL_ADDRESS,
            subjectEmail,
            acsUrl,
            notOnOrAfter,
            notBefore,
            notOnOrAfter,
            spEntityId,
            issueInstant,
            newId());
  }

  private static String newId() {
    return "_" + UUID.randomUUID().toString().replace("-", "");
  }

  private static String readResource(String path) throws IOException {
    try (InputStream in = MockSamlIdp.class.getResourceAsStream(path)) {
      if (in == null) {
        throw new IOException("Test resource not found on classpath: " + path);
      }
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
