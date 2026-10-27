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

import java.util.UUID;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.ontology.NativeOntologyDataGraphPager.Cursor;
import org.openmetadata.service.util.RestUtil;

/** Turns a topology cursor into the {@code topology.after} token and back. */
public final class NativeOntologyTopologyCursorCodec {
  static final int MAX_LENGTH = 8192;
  private static final int VERSION = 1;

  String encode(final Cursor cursor) {
    return RestUtil.encodeCursor(JsonUtils.pojoToJson(WireCursor.of(cursor)));
  }

  Cursor decode(final String token, final String digest) {
    if (token == null || token.isBlank() || token.length() > MAX_LENGTH) {
      throw invalidCursor();
    }
    try {
      return toCursor(JsonUtils.readValue(RestUtil.decodeCursor(token), WireCursor.class), digest);
    } catch (final IllegalArgumentException | JsonParsingException invalid) {
      throw invalidCursor();
    }
  }

  static BadRequestException invalidCursor() {
    return new BadRequestException("Invalid native graph topology cursor");
  }

  private static Cursor toCursor(final WireCursor cursor, final String digest) {
    if (cursor == null || !cursor.isComplete() || !digest.equals(cursor.contextDigest())) {
      throw invalidCursor();
    }
    requireUuidOrEmpty(cursor.semanticAfterId());
    requireUuidOrEmpty(cursor.lineageAfter().fromId());
    requireUuidOrEmpty(cursor.lineageAfter().toId());
    return new Cursor(
        cursor.version(),
        cursor.contextDigest(),
        new AxiomPosition("", cursor.semanticAfterId()),
        cursor.targetOffset(),
        cursor.lineageAfter(),
        cursor.semanticDone(),
        cursor.lineageDone());
  }

  private static void requireUuidOrEmpty(final String value) {
    if (!value.isEmpty()) {
      UUID.fromString(value);
    }
  }

  private record WireCursor(
      int version,
      String contextDigest,
      String semanticAfterId,
      int targetOffset,
      LineagePosition lineageAfter,
      boolean semanticDone,
      boolean lineageDone) {
    static WireCursor of(final Cursor cursor) {
      return new WireCursor(
          cursor.version(),
          cursor.contextDigest(),
          cursor.semanticAfter().id(),
          cursor.targetOffset(),
          cursor.lineageAfter(),
          cursor.semanticDone(),
          cursor.lineageDone());
    }

    boolean isComplete() {
      return version == VERSION
          && semanticAfterId != null
          && targetOffset >= 0
          && lineageAfter != null
          && lineageAfter.fromId() != null
          && lineageAfter.toId() != null
          && lineageAfter.relationType() != null;
    }
  }
}
