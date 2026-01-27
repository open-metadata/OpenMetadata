package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Bot extends org.openmetadata.schema.entity.Bot {

  // Static methods for CRUD operations
  public static Bot create(org.openmetadata.schema.entity.Bot bot) throws OpenMetadataException {
    return (Bot) OpenMetadata.client().bots().create(bot);
  }

  public static Bot retrieve(String id) throws OpenMetadataException {
    return (Bot) OpenMetadata.client().bots().get(id);
  }

  public static Bot retrieve(String id, String fields) throws OpenMetadataException {
    return (Bot) OpenMetadata.client().bots().get(id, fields);
  }

  public static Bot retrieve(UUID id) throws OpenMetadataException {
    return (Bot) OpenMetadata.client().bots().get(id);
  }

  public static Bot retrieveByName(String name) throws OpenMetadataException {
    return (Bot) OpenMetadata.client().bots().getByName(name);
  }

  public static Bot retrieveByName(String name, String fields) throws OpenMetadataException {
    return (Bot) OpenMetadata.client().bots().getByName(name, fields);
  }

  public static BotCollection list() throws OpenMetadataException {
    return new BotCollection(OpenMetadata.client().bots().list());
  }

  public static BotCollection list(ListParams params) throws OpenMetadataException {
    return new BotCollection(OpenMetadata.client().bots().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().bots().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().bots().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().bots().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().bots().deleteAsync(id);
  }

  // Instance methods
  public Bot save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Bot) OpenMetadata.client().bots().create(this);
    } else {
      return (Bot) OpenMetadata.client().bots().update(this.getId(), this);
    }
  }

  public Bot update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a bot without an ID");
    }
    return (Bot) OpenMetadata.client().bots().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a bot without an ID");
    }
    OpenMetadata.client().bots().delete(this.getId());
  }

  // Static builder methods for list/retrieve params
  public static class ListBuilder {
    private final ListParams params = new ListParams();

    public ListBuilder fields(String fields) {
      params.setFields(fields);
      return this;
    }

    public ListBuilder limit(int limit) {
      params.setLimit(limit);
      return this;
    }

    public ListBuilder before(String before) {
      params.setBefore(before);
      return this;
    }

    public ListBuilder after(String after) {
      params.setAfter(after);
      return this;
    }

    public ListBuilder include(String include) {
      params.setFields(include);
      return this;
    }

    public BotCollection list() throws OpenMetadataException {
      return Bot.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class BotCollection implements Iterable<org.openmetadata.schema.entity.Bot> {
    private final ListResponse<org.openmetadata.schema.entity.Bot> response;

    public BotCollection(ListResponse<org.openmetadata.schema.entity.Bot> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.Bot> getData() {
      return response.getData();
    }

    public boolean hasNextPage() {
      return response.hasNextPage();
    }

    public boolean hasPreviousPage() {
      return response.hasPreviousPage();
    }

    public int getTotal() {
      return response.getTotal();
    }

    public BotCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Bot.list(params);
    }

    public BotCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Bot.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.Bot> iterator() {
      return response.getData().iterator();
    }
  }
}
