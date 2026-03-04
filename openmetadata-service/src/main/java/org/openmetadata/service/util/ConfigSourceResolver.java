package org.openmetadata.service.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ConfigSource;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class ConfigSourceResolver {

  private ConfigSourceResolver() {}

  public static String computeHash(Object configValue) {
    try {
      String json = JsonUtils.pojoToJson(configValue);
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashBytes = digest.digest(json.getBytes(StandardCharsets.UTF_8));
      StringBuilder hexString = new StringBuilder();
      for (byte b : hashBytes) {
        String hex = Integer.toHexString(0xff & b);
        if (hex.length() == 1) hexString.append('0');
        hexString.append(hex);
      }
      return hexString.toString();
    } catch (NoSuchAlgorithmException e) {
      LOG.error("SHA-256 algorithm not available", e);
      throw new RuntimeException("Failed to compute config hash", e);
    }
  }

  public static boolean shouldUseEnvValue(
      ConfigSource configSource,
      String currentEnvHash,
      String storedEnvHash,
      Timestamp envSyncTimestamp,
      Timestamp dbModifiedTimestamp,
      Timestamp currentRestartTime) {

    switch (configSource) {
      case ENV:
        return true;
      case DB:
        return false;
      case AUTO:
        boolean envChanged = !currentEnvHash.equals(storedEnvHash);
        if (envChanged) {
          if (dbModifiedTimestamp == null) {
            return true;
          }
          return currentRestartTime.after(dbModifiedTimestamp);
        }
        return false;
      default:
        return false;
    }
  }

  public static Timestamp now() {
    return Timestamp.from(Instant.now());
  }
}
