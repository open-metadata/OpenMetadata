package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

public final class Apps {
  private static OpenMetadataClient defaultClient;

  private Apps() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Apps.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static AppInstaller install() {
    return new AppInstaller(getClient());
  }

  public static App get(String id) {
    return getClient().getHttpClient().execute(HttpMethod.GET, "/v1/apps/" + id, null, App.class);
  }

  public static App getByName(String name) {
    return getClient()
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/apps/name/" + name, null, App.class);
  }

  public static App getByName(String name, String fields) {
    return getClient()
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/apps/name/" + name + "?fields=" + fields, null, App.class);
  }

  public static void delete(String id) {
    getClient().getHttpClient().execute(HttpMethod.DELETE, "/v1/apps/" + id, null, Void.class);
  }

  public static void uninstall(String name, boolean hardDelete) {
    String path = "/v1/apps/name/" + name + "?hardDelete=" + hardDelete;
    getClient().getHttpClient().execute(HttpMethod.DELETE, path, null, Void.class);
  }

  public static AppFinder find(String id) {
    return new AppFinder(getClient(), id, false);
  }

  public static AppFinder findByName(String name) {
    return new AppFinder(getClient(), name, true);
  }

  public static AppTrigger trigger(String name) {
    return new AppTrigger(getClient(), name);
  }

  public static class AppInstaller {
    private final OpenMetadataClient client;
    private final CreateApp request = new CreateApp();

    AppInstaller(OpenMetadataClient client) {
      this.client = client;
    }

    public AppInstaller name(String name) {
      request.setName(name);
      return this;
    }

    public AppInstaller withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public AppInstaller withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public AppInstaller withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public App execute() {
      return client.getHttpClient().execute(HttpMethod.POST, "/v1/apps", request, App.class);
    }
  }

  public static class AppFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isByName;
    private final Set<String> includes = new HashSet<>();

    AppFinder(OpenMetadataClient client, String identifier, boolean isByName) {
      this.client = client;
      this.identifier = identifier;
      this.isByName = isByName;
    }

    public AppFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public App fetch() {
      String path = isByName ? "/v1/apps/name/" + identifier : "/v1/apps/" + identifier;
      if (!includes.isEmpty()) {
        path += "?fields=" + String.join(",", includes);
      }
      return client.getHttpClient().execute(HttpMethod.GET, path, null, App.class);
    }
  }

  public static class AppTrigger {
    private final OpenMetadataClient client;
    private final String appName;

    AppTrigger(OpenMetadataClient client, String appName) {
      this.client = client;
      this.appName = appName;
    }

    public void run() {
      client
          .getHttpClient()
          .execute(HttpMethod.POST, "/v1/apps/trigger/" + appName, null, Void.class);
    }
  }
}
