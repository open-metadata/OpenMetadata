package org.openmetadata.service.jdbi3;

enum ReadPrefetchKey {
  TABLE_DEFAULT_FIELDS("table.defaultFields"),
  API_ENDPOINT_DEFAULT_FIELDS("apiEndpoint.defaultFields");

  private final String value;

  ReadPrefetchKey(String value) {
    this.value = value;
  }

  String value() {
    return value;
  }
}
