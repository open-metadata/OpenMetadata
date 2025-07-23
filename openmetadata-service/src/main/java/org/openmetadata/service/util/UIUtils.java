package org.openmetadata.service.util;

/**
 * Utility class for UI-related operations and path handling
 */
public class UIUtils {

  /**
   * Formats the base path for UI assets by removing trailing slashes
   * to prevent double slashes when webpack injects assets.
   * 
   * @param basePath the base path from configuration
   * @return formatted base path without trailing slash
   */
  public static String formatBasePathForUI(String basePath) {
    if (basePath == null) {
      return "";
    }
    
    // Remove trailing slash to avoid double slashes in webpack-generated assets
    if (basePath.endsWith("/")) {
      return basePath.substring(0, basePath.length() - 1);
    }
    
    return basePath;
  }
} 