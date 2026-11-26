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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.SequencedSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads an identity provider certificate the way the server read it before 2.0.10, leniently, and
 * writes it back as standard PEM, which the stricter reader of 2.0.10 also accepts.
 *
 * <p>The lenient reading takes the text between each {@code BEGIN} and {@code END CERTIFICATE}
 * marker, or the whole value when it has no markers, drops every whitespace character and decodes
 * the rest as base64. Standard PEM puts each marker on its own line and wraps the base64 at 64
 * characters, with the certificates in their original order, each once.
 */
final class IdpCertificatePem {
  private static final String BEGIN = "-----BEGIN CERTIFICATE-----";
  private static final String END = "-----END CERTIFICATE-----";
  private static final Pattern BLOCK =
      Pattern.compile(Pattern.quote(BEGIN) + "(.*?)" + Pattern.quote(END), Pattern.DOTALL);
  private static final Pattern WHITESPACE = Pattern.compile("\\s+");
  private static final int LINE_LENGTH = 64;
  private static final byte[] LINE_SEPARATOR = "\n".getBytes(StandardCharsets.US_ASCII);

  private IdpCertificatePem() {}

  /**
   * The standard PEM form of {@code value}, or empty when the value holds anything that is not an
   * X.509 certificate: text outside the markers, invalid base64 or bytes that are not a certificate.
   */
  static Optional<String> standardPem(final String value) {
    return encodedBlocks(value)
        .flatMap(IdpCertificatePem::certificatesOf)
        .map(IdpCertificatePem::toPem);
  }

  private static Optional<List<String>> encodedBlocks(final String value) {
    return value.contains(BEGIN) ? markedBlocks(value) : Optional.of(List.of(value));
  }

  private static Optional<List<String>> markedBlocks(final String value) {
    final Matcher matcher = BLOCK.matcher(value);
    final List<String> blocks = new ArrayList<>();
    final StringBuilder outside = new StringBuilder();
    int previousEnd = 0;
    while (matcher.find()) {
      outside.append(value, previousEnd, matcher.start());
      blocks.add(matcher.group(1));
      previousEnd = matcher.end();
    }
    outside.append(value.substring(previousEnd));
    return outside.toString().isBlank() ? Optional.of(blocks) : Optional.empty();
  }

  private static Optional<SequencedSet<String>> certificatesOf(final List<String> blocks) {
    final SequencedSet<String> certificates = new LinkedHashSet<>();
    boolean readable = true;
    for (final String block : blocks) {
      final Optional<List<String>> decoded = decode(block);
      decoded.ifPresent(certificates::addAll);
      readable = readable && decoded.isPresent();
    }
    return readable ? Optional.of(certificates) : Optional.empty();
  }

  /** The base64 DER of each certificate in one block, when the block is nothing but certificates. */
  private static Optional<List<String>> decode(final String block) {
    Optional<List<String>> certificates = Optional.empty();
    try {
      final byte[] der = Base64.getDecoder().decode(WHITESPACE.matcher(block).replaceAll(""));
      final Collection<? extends Certificate> parsed =
          CertificateFactory.getInstance("X.509")
              .generateCertificates(new ByteArrayInputStream(der));
      if (!parsed.isEmpty() && Arrays.equals(der, concatenatedEncodings(parsed))) {
        certificates = Optional.of(parsed.stream().map(IdpCertificatePem::base64Of).toList());
      }
    } catch (IllegalArgumentException | CertificateException e) {
      certificates = Optional.empty();
    }
    return certificates;
  }

  private static byte[] concatenatedEncodings(final Collection<? extends Certificate> certificates)
      throws CertificateException {
    final ByteArrayOutputStream encodings = new ByteArrayOutputStream();
    for (final Certificate certificate : certificates) {
      encodings.writeBytes(certificate.getEncoded());
    }
    return encodings.toByteArray();
  }

  private static String base64Of(final Certificate certificate) {
    try {
      return Base64.getEncoder().encodeToString(certificate.getEncoded());
    } catch (CertificateException e) {
      throw new IllegalStateException("A parsed certificate has no encoding", e);
    }
  }

  private static String toPem(final SequencedSet<String> certificates) {
    final Base64.Encoder lines = Base64.getMimeEncoder(LINE_LENGTH, LINE_SEPARATOR);
    return String.join(
        "\n",
        certificates.stream()
            .map(Base64.getDecoder()::decode)
            .map(der -> BEGIN + "\n" + lines.encodeToString(der) + "\n" + END)
            .toList());
  }
}
