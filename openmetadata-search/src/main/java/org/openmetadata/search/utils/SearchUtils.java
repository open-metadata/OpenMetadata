package org.openmetadata.search.utils;

public class SearchUtils {

  public static boolean nullOrEmpty(String str) {
    return str == null || str.trim().isEmpty();
  }

  public static boolean isNullOrEmpty(String str) {
    return nullOrEmpty(str);
  }
}
