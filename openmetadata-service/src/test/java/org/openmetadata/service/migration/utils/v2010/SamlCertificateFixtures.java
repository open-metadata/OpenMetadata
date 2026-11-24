/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.migration.utils.v2010;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

/** The IdP certificates and layouts the 2.0.10 certificate tests share. */
final class SamlCertificateFixtures {
  static final String BEGIN = "-----BEGIN CERTIFICATE-----";
  static final String END = "-----END CERTIFICATE-----";
  static final String MOCK_IDP = resource("/saml/mock-idp.crt").strip();
  static final String OTHER_IDP = resource("/saml/other-idp.crt").strip();

  private SamlCertificateFixtures() {}

  /** The certificate on one line, markers included, as the 2.0.10 step finds it stored. */
  static String singleLine(final String pem) {
    return BEGIN + body(pem) + END;
  }

  /** The base64 body of the certificate, without markers or whitespace. */
  static String body(final String pem) {
    return pem.replace(BEGIN, "").replace(END, "").replaceAll("\\s+", "");
  }

  private static String resource(final String path) {
    try (InputStream stream = SamlCertificateFixtures.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException unreadable) {
      throw new UncheckedIOException(unreadable);
    }
  }
}
