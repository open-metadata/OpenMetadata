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

package org.openmetadata.service.util;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.core.exc.StreamConstraintsException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonException;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;

/**
 * Reads a JSON Patch within fixed bounds, so one request cannot make the server build an unbounded
 * document before anything is authorized (ADR:2026-11-03-input-parsing-is-bounded). The same bounds
 * guard the REST reader and the MCP tool.
 */
public final class BoundedJsonPatch {
  /** About 32 MiB of request body; Jackson counts the document length in bytes or chars read. */
  public static final long MAX_DOCUMENT_LENGTH = 32L * 1024 * 1024;

  public static final int MAX_OPERATIONS = 100_000;

  private static final ObjectMapper MAPPER =
      new ObjectMapper(
              new JsonFactory()
                  .setStreamReadConstraints(
                      StreamReadConstraints.builder()
                          .maxDocumentLength(MAX_DOCUMENT_LENGTH)
                          .maxNameLength(64 * 1024)
                          .maxStringLength(16 * 1024 * 1024)
                          .maxNestingDepth(256)
                          .build()))
          // Read numbers exactly, so writing the tree back for the JSON-P reader changes no value.
          .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
          .setNodeFactory(JsonNodeFactory.withExactBigDecimals(true));

  private BoundedJsonPatch() {}

  /** Thrown when a patch is larger than the bounds allow; the caller answers 413. */
  public static class PatchTooLargeException extends RuntimeException {
    public PatchTooLargeException(String message) {
      super(message);
    }
  }

  /** Thrown when the body is not a well-formed JSON Patch array; the caller answers 400. */
  public static class InvalidPatchException extends RuntimeException {
    public InvalidPatchException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  public static JsonPatch read(InputStream entityStream) {
    return Json.createPatch(readArray(entityStream));
  }

  public static JsonPatch read(String rawPatch) {
    return Json.createPatch(readArray(rawPatch));
  }

  /** The operations array within the bounds; the caller may check each operation's shape. */
  public static JsonArray readArray(InputStream entityStream) {
    try {
      return toArray(MAPPER.readTree(entityStream));
    } catch (StreamConstraintsException e) {
      throw new PatchTooLargeException(e.getOriginalMessage());
    } catch (IOException e) {
      throw new InvalidPatchException("Failed to parse JSON Patch", e);
    }
  }

  public static JsonArray readArray(String rawPatch) {
    if (rawPatch == null || rawPatch.isEmpty()) {
      throw new InvalidPatchException("A JSON Patch document is required", null);
    }
    try {
      return toArray(MAPPER.readTree(rawPatch));
    } catch (StreamConstraintsException e) {
      throw new PatchTooLargeException(e.getOriginalMessage());
    } catch (IOException e) {
      throw new InvalidPatchException("Failed to parse JSON Patch", e);
    }
  }

  private static JsonArray toArray(JsonNode node) {
    if (node == null || !node.isArray()) {
      throw new InvalidPatchException("A JSON Patch must be an array of operations", null);
    }
    if (node.size() > MAX_OPERATIONS) {
      throw new PatchTooLargeException(
          "JSON Patch has more than " + MAX_OPERATIONS + " operations");
    }
    try (JsonReader reader = Json.createReader(new StringReader(node.toString()))) {
      return reader.readArray();
    } catch (JsonException e) {
      throw new InvalidPatchException("Failed to parse JSON Patch", e);
    }
  }
}
