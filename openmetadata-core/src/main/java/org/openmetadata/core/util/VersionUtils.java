package org.openmetadata.core.util;

import java.io.InputStream;
import java.util.Properties;
import java.util.regex.Pattern;

import org.openmetadata.catalog.api.CatalogVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class VersionUtils {
  private static final Logger LOG = LoggerFactory.getLogger(CommonUtil.class);

  private VersionUtils() {}

  public static CatalogVersion getCatalogVersion(String resourceName) {
    CatalogVersion catalogVersion = new CatalogVersion();
    try {
      InputStream fileInput = VersionUtils.class.getResourceAsStream(resourceName);
      Properties props = new Properties();
      props.load(fileInput);
      catalogVersion.setVersion(props.getProperty("version", "unknown"));
      catalogVersion.setRevision(props.getProperty("revision", "unknown"));

      String timestampAsString = props.getProperty("timestamp");
      Long timestamp = timestampAsString != null ? Long.valueOf(timestampAsString) : null;
      catalogVersion.setTimestamp(timestamp);
    } catch (Exception ie) {
      LOG.warn("Failed to read catalog version file");
    }
    return catalogVersion;
  }

  public static String getVersionFromString(String input){
    if (input.contains("-")) {
      return input.split(Pattern.quote("-"))[0];
    } else {
      throw new IllegalArgumentException("Invalid Version Given :" + input);
    }
  }
}
