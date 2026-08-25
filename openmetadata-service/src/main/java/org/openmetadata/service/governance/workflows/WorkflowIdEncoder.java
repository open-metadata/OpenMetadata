package org.openmetadata.service.governance.workflows;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class WorkflowIdEncoder {
  private static final int MAX_FLOWABLE_ID_LENGTH = 64;
  private static final int SAFE_ID_LENGTH = 50;
  private static final Map<String, String> ID_CACHE = new ConcurrentHashMap<>();
  private static final Map<String, String> REVERSE_CACHE = new ConcurrentHashMap<>();

  private WorkflowIdEncoder() {}

  public static String encodeId(String originalId) {
    if (originalId == null || originalId.isEmpty()) {
      return originalId;
    }

    return ID_CACHE.computeIfAbsent(
        originalId,
        id -> {
          String encoded =
              Base64.getUrlEncoder()
                  .withoutPadding()
                  .encodeToString(id.getBytes(StandardCharsets.UTF_8))
                  .replace("-", "_")
                  .replace("+", "_");

          if (encoded.length() > SAFE_ID_LENGTH) {
            String hash = generateHash(id);
            String prefix = encoded.substring(0, 100);
            encoded = prefix + "_" + hash;
            LOG.debug("Long ID encoded with hash: original={}, encoded={}", id, encoded);
          }

          REVERSE_CACHE.put(encoded, id);
          return encoded;
        });
  }

  public static String decodeId(String encodedId) {
    if (encodedId == null || encodedId.isEmpty()) {
      return encodedId;
    }

    String cached = REVERSE_CACHE.get(encodedId);
    if (cached != null) {
      return cached;
    }

    if (encodedId.contains("_") && encodedId.length() > 100) {
      LOG.warn("Cannot decode hashed ID: {}", encodedId);
      return encodedId;
    }

    try {
      String decoded =
          new String(
              Base64.getUrlDecoder().decode(encodedId.replace("_", "+").replace("_", "-")),
              StandardCharsets.UTF_8);
      REVERSE_CACHE.put(encodedId, decoded);
      ID_CACHE.put(decoded, encodedId);
      return decoded;
    } catch (Exception e) {
      LOG.error("Failed to decode ID: {}", encodedId, e);
      return encodedId;
    }
  }

  public static String generateSafeFlowableId(String... parts) {
    String combined = String.join("-", parts);

    // Always generate a short hash-based ID for Flowable compatibility
    String hash = generateHash(combined);
    String safeId = "id_" + hash.substring(0, Math.min(hash.length(), 20));
    ID_CACHE.put(combined, safeId);
    REVERSE_CACHE.put(safeId, combined);
    LOG.debug("Generated safe Flowable ID: original={}, safe={}", combined, safeId);
    return safeId;
  }

  private static String generateHash(String input) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));

      String base64Hash =
          Base64.getUrlEncoder().withoutPadding().encodeToString(hash).substring(0, 32);

      return base64Hash.replace("-", "").replace("_", "").replace("+", "").replace("/", "");
    } catch (NoSuchAlgorithmException e) {
      LOG.error("SHA-256 algorithm not available", e);
      return input.hashCode() + "";
    }
  }

  public static void clearCache() {
    ID_CACHE.clear();
    REVERSE_CACHE.clear();
  }
}
