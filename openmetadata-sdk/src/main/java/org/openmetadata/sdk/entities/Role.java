package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Role extends org.openmetadata.schema.entity.teams.Role {

  // Static methods for CRUD operations
  public static Role create(org.openmetadata.schema.entity.teams.Role role)
      throws OpenMetadataException {
    return (Role) OpenMetadata.client().roles().create(role);
  }

  public static Role retrieve(String id) throws OpenMetadataException {
    return (Role) OpenMetadata.client().roles().get(id);
  }

  public static Role retrieve(String id, String fields) throws OpenMetadataException {
    return (Role) OpenMetadata.client().roles().get(id, fields);
  }

  public static Role retrieve(UUID id) throws OpenMetadataException {
    return (Role) OpenMetadata.client().roles().get(id);
  }

  public static Role retrieveByName(String name) throws OpenMetadataException {
    return (Role) OpenMetadata.client().roles().getByName(name);
  }

  public static Role retrieveByName(String name, String fields) throws OpenMetadataException {
    return (Role) OpenMetadata.client().roles().getByName(name, fields);
  }

  public static RoleCollection list() throws OpenMetadataException {
    return new RoleCollection(OpenMetadata.client().roles().list());
  }

  public static RoleCollection list(ListParams params) throws OpenMetadataException {
    return new RoleCollection(OpenMetadata.client().roles().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().roles().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().roles().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().roles().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().roles().deleteAsync(id);
  }

  // Instance methods
  public Role save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Role) OpenMetadata.client().roles().create(this);
    } else {
      return (Role) OpenMetadata.client().roles().update(this.getId(), this);
    }
  }

  public Role update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a role without an ID");
    }
    return (Role) OpenMetadata.client().roles().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a role without an ID");
    }
    OpenMetadata.client().roles().delete(this.getId());
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
      params.setInclude(include);
      return this;
    }

    public RoleCollection list() throws OpenMetadataException {
      return Role.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class RoleCollection
      implements Iterable<org.openmetadata.schema.entity.teams.Role> {
    private final ListResponse<org.openmetadata.schema.entity.teams.Role> response;

    public RoleCollection(ListResponse<org.openmetadata.schema.entity.teams.Role> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.teams.Role> getData() {
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

    public RoleCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Role.list(params);
    }

    public RoleCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Role.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.teams.Role> iterator() {
      return response.getData().iterator();
    }
  }
}
