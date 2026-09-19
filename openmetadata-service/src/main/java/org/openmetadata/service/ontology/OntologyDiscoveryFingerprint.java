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

package org.openmetadata.service.ontology;

import jakarta.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.OntologyDiscoveryContext;
import org.openmetadata.schema.type.OntologyDiscoveryEvidence;

/** Canonical server-side derivation of ontology discovery provenance fingerprints. */
public final class OntologyDiscoveryFingerprint {
  private static final Pattern WHITESPACE = Pattern.compile("\\s+");

  private OntologyDiscoveryFingerprint() {}

  /**
   * Derive the same fingerprint as the ontology agent from the persisted provenance fields.
   * Candidate prose is intentionally absent so a wording-only change cannot recreate a discarded
   * draft.
   */
  public static String derive(final String targetOntology, final OntologyDiscoveryContext context) {
    if (context == null || context.getEvidence() == null || context.getEvidence().isEmpty()) {
      throw new BadRequestException("Ontology discovery context requires evidence");
    }
    if (context.getVerificationProvider() == null) {
      throw new BadRequestException("Ontology discovery context requires a verification provider");
    }

    final String evidence =
        context.getEvidence().stream()
            .map(OntologyDiscoveryFingerprint::canonicalEvidence)
            .sorted()
            .collect(Collectors.joining("\n"));
    final String canonical =
        String.join(
            "\n",
            normalize(context.getRuleVersion()),
            normalize(context.getServiceFqn()),
            normalize(targetOntology),
            normalize(context.getVerificationProvider().value()),
            normalize(context.getVerificationModelId()),
            evidence);
    return sha256(canonical);
  }

  /** Reject provenance that is not a digest of the supplied immutable context. */
  public static void requireMatch(
      final String targetOntology, final OntologyDiscoveryContext context) {
    final String derived = derive(targetOntology, context);
    if (!Objects.equals(derived, context.getEvidenceFingerprint())) {
      throw new BadRequestException(
          "Ontology discovery evidenceFingerprint does not match its canonical evidence");
    }
  }

  private static String canonicalEvidence(final OntologyDiscoveryEvidence evidence) {
    final String signals =
        Objects.requireNonNullElse(evidence.getSignals(), Set.<String>of()).stream()
            .map(OntologyDiscoveryFingerprint::normalize)
            .sorted()
            .collect(Collectors.joining(","));
    return String.join(
        "|",
        normalize(evidence.getEntityType()),
        normalize(evidence.getFullyQualifiedName()),
        value(evidence.getSourceVersion()),
        value(evidence.getUpdatedAt()),
        normalize(evidence.getSourceRunId()),
        signals);
  }

  private static String value(final Object value) {
    return value == null ? "" : value.toString();
  }

  private static String normalize(final String value) {
    return value == null
        ? ""
        : WHITESPACE.matcher(value.trim()).replaceAll(" ").toLowerCase(Locale.ROOT);
  }

  private static String sha256(final String canonical) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(canonical.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException("JVM does not provide SHA-256", impossible);
    }
  }
}
