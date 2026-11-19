/*
 *  Copyright 2026 Collate.
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

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.List;

public final class SamlCertificates {
  private static final String PEM_BEGIN = "-----BEGIN CERTIFICATE-----";

  private SamlCertificates() {}

  public static List<X509Certificate> parse(String value) throws CertificateException {
    try {
      if (value.replace(PEM_BEGIN, "").replace("-----END CERTIFICATE-----", "").isBlank()) {
        throw new CertificateException("Certificate data is empty after removing PEM headers");
      }
      byte[] encoded =
          value.contains(PEM_BEGIN)
              ? value.getBytes(StandardCharsets.US_ASCII)
              : Base64.getDecoder().decode(value.replaceAll("\\s+", ""));
      List<X509Certificate> certificates =
          CertificateFactory.getInstance("X.509")
              .generateCertificates(new ByteArrayInputStream(encoded))
              .stream()
              .map(X509Certificate.class::cast)
              .distinct()
              .toList();
      if (certificates.isEmpty()) {
        throw new CertificateException("No X509 certificates were provided");
      }
      return certificates;
    } catch (IllegalArgumentException e) {
      throw new CertificateException("Invalid X509 certificate encoding", e);
    }
  }
}
