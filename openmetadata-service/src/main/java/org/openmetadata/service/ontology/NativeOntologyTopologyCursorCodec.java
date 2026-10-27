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

import com.macasaet.fernet.Key;
import com.macasaet.fernet.StringValidator;
import com.macasaet.fernet.Token;
import com.macasaet.fernet.TokenValidationException;
import com.macasaet.fernet.Validator;
import java.security.SecureRandom;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.TemporalAmount;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.ontology.NativeOntologyDataGraphPager.Cursor;

/**
 * Seals a topology cursor into the opaque {@code topology.after} token with the servers' shared
 * Fernet keys, and opens it again. The first key seals; any key opens, so rotating keys keeps open
 * cursors. Without a key no cursor is issued and none is accepted. Cursors do not expire, because
 * binding revisions and the axiom position check already retire stale ones.
 */
public final class NativeOntologyTopologyCursorCodec {
  private static final int MAX_LENGTH = 8192;
  private static final int VERSION = 1;
  private static final Validator<String> NO_EXPIRY =
      new StringValidator() {
        @Override
        public TemporalAmount getTimeToLive() {
          return Duration.ofSeconds(Instant.MAX.getEpochSecond());
        }
      };
  private final List<Key> keys;
  private final SecureRandom random = new SecureRandom();

  public NativeOntologyTopologyCursorCodec(final List<Key> keys) {
    this.keys = List.copyOf(keys);
  }

  String encode(final Cursor cursor) {
    if (keys.isEmpty()) {
      throw new IllegalStateException(
          "Set fernetConfiguration.fernetKey to page a native graph topology");
    }
    return Token.generate(random, keys.getFirst(), JsonUtils.pojoToJson(WireCursor.of(cursor)))
        .serialise();
  }

  Cursor decode(final String token, final String digest) {
    if (token == null || token.isBlank() || token.length() > MAX_LENGTH) {
      throw invalidCursor();
    }
    try {
      return toCursor(JsonUtils.readValue(open(token), WireCursor.class), digest);
    } catch (final IllegalArgumentException
        | DateTimeException
        | TokenValidationException
        | JsonParsingException invalid) {
      throw invalidCursor();
    }
  }

  private String open(final String token) {
    return Token.fromString(token).validateAndDecrypt(keys, NO_EXPIRY);
  }

  private static BadRequestException invalidCursor() {
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
