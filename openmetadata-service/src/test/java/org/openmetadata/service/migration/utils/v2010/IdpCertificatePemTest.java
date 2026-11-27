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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class IdpCertificatePemTest {
  private static final String BEGIN = "-----BEGIN CERTIFICATE-----";
  private static final String END = "-----END CERTIFICATE-----";
  private static final String MOCK_IDP = resource("/saml/mock-idp.crt").strip();
  private static final String OTHER_IDP = resource("/saml/other-idp.crt").strip();
  private static final String BUNDLE = MOCK_IDP + "\n" + OTHER_IDP;

  static Stream<Arguments> singleCertificateLayouts() {
    return Stream.of(
        Arguments.of("single line", singleLine(MOCK_IDP)),
        Arguments.of("spaces for line breaks", MOCK_IDP.replace("\n", " ")),
        Arguments.of("spaces before BEGIN", "   " + MOCK_IDP),
        Arguments.of("tab before BEGIN", "\t" + MOCK_IDP),
        Arguments.of("CRLF line breaks", MOCK_IDP.replace("\n", "\r\n")),
        Arguments.of("indented lines", MOCK_IDP.replace("\n", "\n    ")),
        Arguments.of("unwrapped body", BEGIN + "\n" + body(MOCK_IDP) + "\n" + END),
        Arguments.of("76 character lines", BEGIN + "\n" + mime76(MOCK_IDP) + "\n" + END),
        Arguments.of("bare base64", body(MOCK_IDP)),
        Arguments.of("bare base64 at 64 characters", wrapped64(MOCK_IDP)),
        Arguments.of("bare base64 at 76 characters", mime76(MOCK_IDP)),
        Arguments.of("bare base64 with spaces", body(MOCK_IDP).replaceAll("(.{40})", "$1 ")),
        Arguments.of("duplicate", MOCK_IDP + "\n" + MOCK_IDP),
        Arguments.of("duplicate on one line", singleLine(MOCK_IDP) + singleLine(MOCK_IDP)),
        Arguments.of("duplicate in two layouts", MOCK_IDP + "\n" + MOCK_IDP.replace("\n", "\r\n")));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("singleCertificateLayouts")
  void rewritesASingleCertificateAsStandardPem(final String layout, final String stored) {
    assertEquals(Optional.of(MOCK_IDP), IdpCertificatePem.standardPem(stored), layout);
  }

  static Stream<Arguments> bundleLayouts() {
    return Stream.of(
        Arguments.of("standard bundle", BUNDLE),
        Arguments.of("bundle on one line", singleLine(MOCK_IDP) + singleLine(OTHER_IDP)),
        Arguments.of(
            "bundle on one line with a space", singleLine(MOCK_IDP) + " " + singleLine(OTHER_IDP)),
        Arguments.of("bundle with spaces for line breaks", BUNDLE.replace("\n", " ")),
        Arguments.of("bundle with CRLF line breaks", BUNDLE.replace("\n", "\r\n")),
        Arguments.of("bundle with blank lines between", MOCK_IDP + "\n\n\n" + OTHER_IDP + "\n"),
        Arguments.of("bundle with a repeated certificate", BUNDLE + "\n" + MOCK_IDP));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("bundleLayouts")
  void rewritesABundleAsStandardPemInItsOrder(final String layout, final String stored) {
    assertEquals(Optional.of(BUNDLE), IdpCertificatePem.standardPem(stored), layout);
  }

  @Test
  void keepsTheOrderOfABundle() {
    assertEquals(
        Optional.of(OTHER_IDP + "\n" + MOCK_IDP),
        IdpCertificatePem.standardPem(singleLine(OTHER_IDP) + singleLine(MOCK_IDP)));
  }

  @Test
  void leavesStandardPemAsItIs() {
    assertEquals(Optional.of(MOCK_IDP), IdpCertificatePem.standardPem(MOCK_IDP));
    assertEquals(Optional.of(MOCK_IDP), IdpCertificatePem.standardPem(MOCK_IDP + "\n"));
    assertEquals(Optional.of(BUNDLE), IdpCertificatePem.standardPem(BUNDLE));
  }

  static Stream<Arguments> unreadableValues() {
    return Stream.of(
        Arguments.of("text", "not a certificate"),
        Arguments.of("empty", ""),
        Arguments.of("blank", "   \n "),
        Arguments.of("markers only", BEGIN + "\n" + END),
        Arguments.of("BEGIN without END", BEGIN + "\n" + body(MOCK_IDP)),
        Arguments.of("invalid base64", BEGIN + "\nMIIC*not*base64\n" + END),
        Arguments.of("base64 of something else", base64Block("not a certificate")),
        Arguments.of(
            "truncated certificate", BEGIN + "\n" + body(MOCK_IDP).substring(0, 400) + "\n" + END),
        Arguments.of(
            "certificate followed by junk bytes",
            BEGIN + "\n" + withTrailingBytes(MOCK_IDP) + "\n" + END),
        Arguments.of("text before a certificate", "subject=CN=mock-idp\n" + MOCK_IDP),
        Arguments.of("text between certificates", MOCK_IDP + "\nnext one\n" + OTHER_IDP),
        Arguments.of("a readable and an unreadable block", MOCK_IDP + "\n" + base64Block("junk")),
        Arguments.of("another PEM type", MOCK_IDP.replace("CERTIFICATE", "PUBLIC KEY")));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("unreadableValues")
  void readsNothingFromAValueThatIsNotOnlyCertificates(final String layout, final String stored) {
    assertEquals(Optional.empty(), IdpCertificatePem.standardPem(stored), layout);
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("singleCertificateLayouts")
  void writesWhatTheJdkCertificateParserReads(final String layout, final String stored)
      throws CertificateException {
    final String pem = IdpCertificatePem.standardPem(stored).orElseThrow();
    assertEquals(1, jdkCertificates(pem).size(), layout);
    assertEquals(Optional.of(pem), IdpCertificatePem.standardPem(pem), "a second pass is a no-op");
  }

  @Test
  void writesABundleTheJdkCertificateParserReadsInFull() throws CertificateException {
    final String pem =
        IdpCertificatePem.standardPem(singleLine(MOCK_IDP) + singleLine(OTHER_IDP)).orElseThrow();
    final List<? extends Certificate> certificates = jdkCertificates(pem);
    assertEquals(2, certificates.size());
    assertTrue(pem.lines().allMatch(line -> line.length() <= 64), "lines wrap at 64 characters");
  }

  private static List<? extends Certificate> jdkCertificates(final String pem)
      throws CertificateException {
    return List.copyOf(
        CertificateFactory.getInstance("X.509")
            .generateCertificates(
                new ByteArrayInputStream(pem.getBytes(StandardCharsets.US_ASCII))));
  }

  private static String singleLine(final String pem) {
    return BEGIN + body(pem) + END;
  }

  private static String body(final String pem) {
    return pem.replace(BEGIN, "").replace(END, "").replaceAll("\\s+", "");
  }

  private static String wrapped64(final String pem) {
    return pem.replace(BEGIN + "\n", "").replace("\n" + END, "");
  }

  private static String mime76(final String pem) {
    return Base64.getMimeEncoder().encodeToString(Base64.getDecoder().decode(body(pem)));
  }

  private static String base64Block(final String content) {
    return BEGIN
        + "\n"
        + Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8))
        + "\n"
        + END;
  }

  private static String withTrailingBytes(final String pem) {
    final byte[] der = Base64.getDecoder().decode(body(pem));
    final byte[] padded = new byte[der.length + 4];
    System.arraycopy(der, 0, padded, 0, der.length);
    return Base64.getEncoder().encodeToString(padded);
  }

  private static String resource(final String path) {
    try (InputStream stream = IdpCertificatePemTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
