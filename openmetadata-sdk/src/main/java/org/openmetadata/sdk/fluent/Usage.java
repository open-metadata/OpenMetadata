package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.EntityUsage;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

public final class Usage {
  private static OpenMetadataClient defaultClient;

  private Usage() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Usage.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static UsageReporter reportFor(String entityType, String entityId) {
    return new UsageReporter(getClient(), entityType, entityId);
  }

  public static UsageReporter reportFor(String entityType, UUID entityId) {
    return reportFor(entityType, entityId.toString());
  }

  public static EntityUsage getForTable(String tableId) {
    return getClient()
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/usage/table/" + tableId, null, EntityUsage.class);
  }

  public static EntityUsage getForTable(String tableId, String date, int days) {
    String path = "/v1/usage/table/" + tableId + "?date=" + date + "&days=" + days;
    return getClient().getHttpClient().execute(HttpMethod.GET, path, null, EntityUsage.class);
  }

  public static EntityUsage getForEntity(String entityType, String entityId) {
    return getClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET, "/v1/usage/" + entityType + "/" + entityId, null, EntityUsage.class);
  }

  public static EntityUsage getForEntity(
      String entityType, String entityId, String date, int days) {
    String path = "/v1/usage/" + entityType + "/" + entityId + "?date=" + date + "&days=" + days;
    return getClient().getHttpClient().execute(HttpMethod.GET, path, null, EntityUsage.class);
  }

  public static EntityUsage getForEntityByName(
      String entityType, String entityName, String date, int days) {
    String path =
        "/v1/usage/" + entityType + "/name/" + entityName + "?date=" + date + "&days=" + days;
    return getClient().getHttpClient().execute(HttpMethod.GET, path, null, EntityUsage.class);
  }

  public static void computePercentile(String entityType, String date) {
    String path = "/v1/usage/compute.percentile/" + entityType + "/" + date;
    getClient().getHttpClient().execute(HttpMethod.POST, path, null, Void.class);
  }

  public static class UsageReporter {
    private final OpenMetadataClient client;
    private final String entityType;
    private final String entityId;
    private String date;
    private int count = 1;

    UsageReporter(OpenMetadataClient client, String entityType, String entityId) {
      this.client = client;
      this.entityType = entityType;
      this.entityId = entityId;
    }

    public UsageReporter onDate(String date) {
      this.date = date;
      return this;
    }

    public UsageReporter withCount(int count) {
      this.count = count;
      return this;
    }

    public void report() {
      DailyCount dailyCount = new DailyCount().withCount(count).withDate(date);
      String path = "/v1/usage/" + entityType + "/" + entityId;
      if (date != null) {
        path += "?date=" + date;
      }
      client.getHttpClient().execute(HttpMethod.PUT, path, dailyCount, EntityUsage.class);
    }
  }
}
