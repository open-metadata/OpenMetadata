package org.openmetadata.sdk.entities;

import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Policy extends org.openmetadata.schema.entity.policies.Policy {

  // Static methods for CRUD operations
  public static Policy create(org.openmetadata.schema.entity.policies.Policy policy)
      throws OpenMetadataException {
    return (Policy) OpenMetadata.client().policies().create(policy);
  }

  public static Policy retrieve(String id) throws OpenMetadataException {
    return (Policy) OpenMetadata.client().policies().get(id);
  }

  public static Policy retrieve(String id, String fields) throws OpenMetadataException {
    return (Policy) OpenMetadata.client().policies().get(id, fields);
  }

  public static Policy retrieve(UUID id) throws OpenMetadataException {
    return (Policy) OpenMetadata.client().policies().get(id);
  }

  public static Policy retrieveByName(String name) throws OpenMetadataException {
    return (Policy) OpenMetadata.client().policies().getByName(name);
  }

  public static Policy retrieveByName(String name, String fields) throws OpenMetadataException {
    return (Policy) OpenMetadata.client().policies().getByName(name, fields);
  }

  public static PolicyCollection list() throws OpenMetadataException {
    return new PolicyCollection(OpenMetadata.client().policies().list());
  }

  public static PolicyCollection list(ListParams params) throws OpenMetadataException {
    return new PolicyCollection(OpenMetadata.client().policies().list(params));
  }

  public static void delete(String id) throws OpenMetadataException {
    OpenMetadata.client().policies().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    OpenMetadata.client().policies().delete(id);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return OpenMetadata.client().policies().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return OpenMetadata.client().policies().deleteAsync(id);
  }

  // Instance methods
  public Policy save() throws OpenMetadataException {
    if (this.getId() == null) {
      return (Policy) OpenMetadata.client().policies().create(this);
    } else {
      return (Policy) OpenMetadata.client().policies().update(this.getId(), this);
    }
  }

  public Policy update() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot update a policy without an ID");
    }
    return (Policy) OpenMetadata.client().policies().update(this.getId(), this);
  }

  public void delete() throws OpenMetadataException {
    if (this.getId() == null) {
      throw new IllegalStateException("Cannot delete a policy without an ID");
    }
    OpenMetadata.client().policies().delete(this.getId());
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

    public PolicyCollection list() throws OpenMetadataException {
      return Policy.list(params);
    }
  }

  public static ListBuilder listBuilder() {
    return new ListBuilder();
  }

  // Collection class with auto-pagination
  public static class PolicyCollection
      implements Iterable<org.openmetadata.schema.entity.policies.Policy> {
    private final ListResponse<org.openmetadata.schema.entity.policies.Policy> response;

    public PolicyCollection(ListResponse<org.openmetadata.schema.entity.policies.Policy> response) {
      this.response = response;
    }

    public List<org.openmetadata.schema.entity.policies.Policy> getData() {
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

    public PolicyCollection nextPage() throws OpenMetadataException {
      if (!hasNextPage()) {
        throw new IllegalStateException("No next page available");
      }
      ListParams params = new ListParams().setAfter(response.getPaging().getAfter());
      return Policy.list(params);
    }

    public PolicyCollection previousPage() throws OpenMetadataException {
      if (!hasPreviousPage()) {
        throw new IllegalStateException("No previous page available");
      }
      ListParams params = new ListParams().setBefore(response.getPaging().getBefore());
      return Policy.list(params);
    }

    @Override
    public Iterator<org.openmetadata.schema.entity.policies.Policy> iterator() {
      return response.getData().iterator();
    }
  }
}
