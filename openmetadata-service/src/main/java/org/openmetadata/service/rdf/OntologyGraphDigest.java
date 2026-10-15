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

package org.openmetadata.service.rdf;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.apache.jena.rdf.model.Model;

/**
 * The content digest of one ontology graph: SHA-256 over its canonical N-Triples ({@link
 * OntologyGraphCanonicalForm}, {@value OntologyGraphCanonicalForm#ALGORITHM}), written {@code
 * sha256:<hex>}. Nothing in it depends on blank node labels, so two projections of the same axiom,
 * and the store's copy of either, digest equally.
 *
 * <p>See ADR:2026-10-15-reasoning-closures-are-approved-graphs-pinned-by-a-content-manifest.
 */
public final class OntologyGraphDigest {
  public static final String PREFIX = "sha256:";

  private OntologyGraphDigest() {}

  /**
   * @throws OntologyGraphCanonicalForm.TooSymmetricException when the graph's blank nodes cannot
   *     be canonicalized within the bounds
   */
  public static String of(final Model graph) {
    return sha256(OntologyGraphCanonicalForm.of(graph.getGraph().find().toList()));
  }

  static String sha256(final String text) {
    return PREFIX
        + HexFormat.of().formatHex(newSha256().digest(text.getBytes(StandardCharsets.UTF_8)));
  }

  static MessageDigest newSha256() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is required for ontology digests", e);
    }
  }

  /** The 64 hex digits of a {@code sha256:} digest. */
  static String hex(final String digest) {
    if (digest == null || !digest.startsWith(PREFIX)) {
      throw new IllegalArgumentException("Not a sha256 digest: " + digest);
    }
    return digest.substring(PREFIX.length());
  }
}
