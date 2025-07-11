package org.openmetadata.service.util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;
import javax.ws.rs.core.EntityTag;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;

@Slf4j
public final class EntityETag {
  private static final String ALGORITHM = "SHA-256";
  private static final char[] HEX_ARRAY = "0123456789abcdef".toCharArray();

  private EntityETag() {
    // Utility class
  }

  public static String generateETagValue(EntityInterface entity) {
    if (entity == null) {
      throw new IllegalArgumentException("Entity cannot be null");
    }

    String etagInput = buildETagInput(entity);
    return computeHash(etagInput);
  }

  public static EntityTag generateETag(EntityInterface entity) {
    String etagValue = generateETagValue(entity);
    return new EntityTag(etagValue, false);
  }

  public static EntityTag generateETag(EntityInterface entity, boolean weak) {
    String etagValue = generateETagValue(entity);
    return new EntityTag(etagValue, weak);
  }

  public static boolean matches(String etagValue, EntityInterface entity) {
    if (etagValue == null || entity == null) {
      return false;
    }
    
    String currentETagValue = generateETagValue(entity);
    return etagValue.equals(currentETagValue);
  }

  public static boolean matches(EntityTag etag, EntityInterface entity) {
    if (etag == null || entity == null) {
      return false;
    }
    
    return matches(etag.getValue(), entity);
  }

  private static String buildETagInput(EntityInterface entity) {
    StringBuilder input = new StringBuilder();
    
    UUID id = entity.getId();
    if (id != null) {
      input.append(id.toString());
    }
    
    Double version = entity.getVersion();
    if (version != null) {
      input.append(version.toString());
    }
    
    Long updatedAt = entity.getUpdatedAt();
    if (updatedAt != null) {
      input.append(updatedAt.toString());
    }
    
    return input.toString();
  }

  private static String computeHash(String input) {
    try {
      MessageDigest digest = MessageDigest.getInstance(ALGORITHM);
      byte[] hashBytes = digest.digest(input.getBytes());
      return bytesToHex(hashBytes).substring(0, 16);
    } catch (NoSuchAlgorithmException e) {
      LOG.error("Hash algorithm {} not available", ALGORITHM, e);
      throw new RuntimeException("Failed to generate ETag", e);
    }
  }

  private static String bytesToHex(byte[] bytes) {
    char[] hexChars = new char[bytes.length * 2];
    for (int i = 0; i < bytes.length; i++) {
      int v = bytes[i] & 0xFF;
      hexChars[i * 2] = HEX_ARRAY[v >>> 4];
      hexChars[i * 2 + 1] = HEX_ARRAY[v & 0x0F];
    }
    return new String(hexChars);
  }
}