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

package org.openmetadata.service.secrets;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Who a stored credential belongs to. External secret keys are built from this, never from a name:
 * an id is never reused and never changes, so two owners cannot share a key and renaming an owner
 * leaves its secrets where they are.
 *
 * <p>Each kind of owner keeps one fixed shape of literals and ids, and its first literal is not used
 * by any other kind, so distinct owners always render distinct segments.
 */
public record SecretOwner(List<String> segments) {
  private static final Pattern SEGMENT = Pattern.compile("[a-z0-9]+");

  public SecretOwner {
    if (segments == null || segments.isEmpty()) {
      throw new IllegalArgumentException("A secret owner needs at least one segment");
    }
    segments.forEach(SecretOwner::requireSafeSegment);
    segments = List.copyOf(segments);
  }

  public static Builder builder(String kind) {
    return new Builder(kind);
  }

  private static String requireSafeSegment(String segment) {
    if (segment == null || !SEGMENT.matcher(segment).matches()) {
      throw new IllegalArgumentException(
          String.format("Secret owner segment [%s] must match %s", segment, SEGMENT.pattern()));
    }
    return segment;
  }

  public static final class Builder {
    private final List<String> segments = new ArrayList<>();

    private Builder(String kind) {
      segments.add(requireSafeSegment(kind));
    }

    public Builder literal(String literal) {
      segments.add(requireSafeSegment(literal));
      return this;
    }

    public Builder id(UUID id) {
      segments.add(SecretKeyEncoding.encodeId(Objects.requireNonNull(id, "id")));
      return this;
    }

    public SecretOwner build() {
      return new SecretOwner(segments);
    }
  }
}
