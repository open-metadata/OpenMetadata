/*
 *  Copyright 2021 Collate
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

import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.exception.PreconditionFailedException;

/**
 * Utility class for generating and validating ETags for entities.
 * ETags are used for optimistic concurrency control to prevent lost updates
 * in concurrent modification scenarios.
 */
@Slf4j
public class EntityETag {

  public static final String ETAG_HEADER = "ETag";
  public static final String IF_MATCH_HEADER = "If-Match";
  public static final String IF_NONE_MATCH_HEADER = "If-None-Match";

  private static final String ETAG_PREFIX = "\"";
  private static final String ETAG_SUFFIX = "\"";
  private static final String WEAK_PREFIX = "W/";

  /**
   * Generate an ETag for an entity based on its version and last updated timestamp.
   * Format: "version-updatedAt" wrapped in quotes as per HTTP ETag specification.
   *
   * @param entity The entity to generate ETag for
   * @return ETag string in format "version-updatedAt"
   */
  public static String generateETag(EntityInterface entity) {
    if (entity == null) {
      return null;
    }

    // Use version and updatedAt to generate a unique ETag
    String etagValue = entity.getVersion() + "-" + entity.getUpdatedAt();

    // Generate SHA-256 hash for consistency and to handle special characters
    String hash = generateHash(etagValue);

    // Return ETag wrapped in quotes as per HTTP specification
    return ETAG_PREFIX + hash + ETAG_SUFFIX;
  }

  /**
   * Generate a weak ETag that only considers the version.
   * Weak ETags are prefixed with W/ and are useful when byte-for-byte equality is not required.
   *
   * @param entity The entity to generate weak ETag for
   * @return Weak ETag string in format W/"version"
   */
  public static String generateWeakETag(EntityInterface entity) {
    if (entity == null) {
      return null;
    }

    return WEAK_PREFIX + ETAG_PREFIX + entity.getVersion() + ETAG_SUFFIX;
  }

  /**
   * Validate if the provided ETag matches the entity's current ETag.
   * If validation is enabled and ETags don't match, throws PreconditionFailedException.
   *
   * @param ifMatchHeader The If-Match header value from the request
   * @param entity The current entity
   * @param enforceETag Whether to enforce ETag validation (optional for backward compatibility)
   * @throws PreconditionFailedException if ETags don't match and enforcement is enabled
   */
  public static void validateETag(
      String ifMatchHeader, EntityInterface entity, boolean enforceETag) {
    LOG.info(
        "validateETag called - ifMatchHeader: {}, enforceETag: {}, entity: {}",
        ifMatchHeader,
        enforceETag,
        entity.getId());

    if (!enforceETag || ifMatchHeader == null || ifMatchHeader.isEmpty()) {
      // ETag validation is optional - skip if not enforced or no header provided
      LOG.info(
          "ETag validation skipped - enforceETag: {}, ifMatchHeader: {}",
          enforceETag,
          ifMatchHeader);
      return;
    }

    String currentETag = generateETag(entity);
    LOG.info("Current ETag for entity {}: {}", entity.getId(), currentETag);

    // Handle multiple ETags in If-Match header (comma-separated)
    String[] providedETags = ifMatchHeader.split(",");
    for (String providedETag : providedETags) {
      String trimmedETag = providedETag.trim();
      if ("*".equals(trimmedETag) || currentETag.equals(trimmedETag)) {
        // Match found - validation successful
        return;
      }

      // Also check weak ETag match
      if (isWeakMatch(trimmedETag, entity)) {
        return;
      }
    }

    // No match found - throw exception
    LOG.warn(
        "ETag mismatch for entity {}. Expected: {}, Provided: {}",
        entity.getId(),
        currentETag,
        ifMatchHeader);
    throw new PreconditionFailedException(
        "The entity has been modified. Current ETag: "
            + currentETag
            + ". Please refresh and retry with the latest version.");
  }

  /**
   * Add ETag header to response
   *
   * @param responseBuilder The response builder
   * @param entity The entity to generate ETag from
   * @return The response builder with ETag header added
   */
  public static Response.ResponseBuilder addETagHeader(
      Response.ResponseBuilder responseBuilder, EntityInterface entity) {
    String etag = generateETag(entity);
    if (etag != null) {
      responseBuilder.header(ETAG_HEADER, etag);
    }
    return responseBuilder;
  }

  /**
   * Check if the provided ETag is a weak match for the entity
   *
   * @param providedETag The ETag to check
   * @param entity The entity to match against
   * @return true if weak match, false otherwise
   */
  private static boolean isWeakMatch(String providedETag, EntityInterface entity) {
    if (providedETag.startsWith(WEAK_PREFIX)) {
      String weakETag = generateWeakETag(entity);
      return weakETag.equals(providedETag);
    }
    return false;
  }

  /**
   * Generate SHA-256 hash of the input string
   *
   * @param input The string to hash
   * @return Hex string representation of the hash
   */
  private static String generateHash(String input) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));

      // Convert to hex string
      StringBuilder hexString = new StringBuilder();
      for (byte b : hash) {
        String hex = Integer.toHexString(0xff & b);
        if (hex.length() == 1) {
          hexString.append('0');
        }
        hexString.append(hex);
      }

      // Return first 16 characters for brevity
      return hexString.substring(0, 16);
    } catch (NoSuchAlgorithmException e) {
      LOG.error("SHA-256 algorithm not available", e);
      // Fallback to simple string
      return input.replace("-", "");
    }
  }

  /**
   * Check if ETag validation should be enforced based on configuration
   * This can be extended to read from configuration files
   *
   * @return true if ETag validation should be enforced
   */
  public static boolean isETagEnforcementEnabled() {
    // TODO: Read from configuration
    // For now, return false for backward compatibility
    return false;
  }
}
