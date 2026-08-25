package org.openmetadata.schema.utils;

import java.io.InputStream;
import java.util.Properties;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.OpenMetadataServerVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class VersionUtils {
  private static final Logger LOG = LoggerFactory.getLogger(VersionUtils.class);

  private VersionUtils() {}

  public static OpenMetadataServerVersion getOpenMetadataServerVersion(String resourceName) {
    OpenMetadataServerVersion version = new OpenMetadataServerVersion();
    try {
      InputStream fileInput = VersionUtils.class.getResourceAsStream(resourceName);
      Properties props = new Properties();
      props.load(fileInput);
      version.setVersion(props.getProperty("version", "unknown"));
      version.setRevision(props.getProperty("revision", "unknown"));

      String timestampAsString = props.getProperty("timestamp");
      Long timestamp = timestampAsString != null ? Long.valueOf(timestampAsString) : null;
      version.setTimestamp(timestamp);
    } catch (Exception ie) {
      LOG.warn("Failed to read catalog version file");
    }
    return version;
  }

  public static String[] getVersionFromString(String input) {
    return input.split(Pattern.quote("."));
  }

  /**
   * Extracts the {@code MAJOR.MINOR} portion of a version string, ignoring the patch level and any
   * qualifier such as {@code -SNAPSHOT}. Two versions sharing the same major/minor differ only by a
   * patch release (e.g. {@code 1.12.8} and {@code 1.12.9} both yield {@code 1.12}).
   */
  public static String getMajorMinorVersion(String version) {
    String majorMinor = version;
    if (version != null) {
      String[] parts = getVersionFromString(version);
      if (parts.length >= 2) {
        majorMinor = parts[0] + "." + parts[1];
      }
    }
    return majorMinor;
  }
}
