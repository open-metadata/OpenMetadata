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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;

/**
 * A library install cut into slices that apply one after another. Concepts come before properties
 * and properties before axioms across all slices, so a slice only references definitions that an
 * earlier slice or the same slice declares. Each slice holds at most the sliceable member count of
 * operations.
 */
public record OntologyPackSlicePlan(List<Slice> slices, String planDigest, int memberCount) {
  public record Slice(int index, List<OntologyChangeOperation> operations, String digest) {}

  public static OntologyPackSlicePlan of(
      final List<OntologyChangeOperation> operations,
      final int sliceMembers,
      final String packDigest) {
    if (sliceMembers < 1) {
      throw new IllegalArgumentException("A slice holds at least one member");
    }
    operations.forEach(OntologyPackSlicePlan::rank);
    final List<OntologyChangeOperation> ordered =
        operations.stream().sorted(Comparator.comparingInt(OntologyPackSlicePlan::rank)).toList();
    final List<Slice> slices = new ArrayList<>();
    for (int from = 0; from < ordered.size(); from += sliceMembers) {
      final int to = Math.min(ordered.size(), from + sliceMembers);
      final List<OntologyChangeOperation> members = List.copyOf(ordered.subList(from, to));
      slices.add(new Slice(slices.size(), members, sliceDigest(members)));
    }
    final List<String> digests = slices.stream().map(Slice::digest).toList();
    return new OntologyPackSlicePlan(
        List.copyOf(slices), planDigest(packDigest, digests), ordered.size());
  }

  /** Independent of operation order, generated operation ids and generated definition ids. */
  public static String sliceDigest(final List<OntologyChangeOperation> operations) {
    final String joined =
        operations.stream()
            .map(OntologyPackInstallations::normalizedOperation)
            .map(OntologyJson::canonical)
            .map(Object::toString)
            .sorted()
            .collect(Collectors.joining("\n"));
    return DigestUtils.sha256Hex(joined);
  }

  public static String planDigest(final String packDigest, final List<String> sliceDigests) {
    return DigestUtils.sha256Hex(packDigest + "\n" + String.join("\n", sliceDigests));
  }

  public List<String> sliceDigests() {
    return slices.stream().map(Slice::digest).toList();
  }

  private static int rank(final OntologyChangeOperation operation) {
    final OntologyChangeOperationType type = operation.getOperationType();
    return switch (type) {
      case UPSERT_CONCEPT -> 0;
      case UPSERT_PROPERTY -> 1;
      case UPSERT_AXIOM -> 2;
      default -> throw new IllegalArgumentException(
          "A library install plan holds only upserts, not " + type);
    };
  }
}
