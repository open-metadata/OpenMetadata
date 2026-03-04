package org.openmetadata.sdk.models;

import java.util.HashMap;
import java.util.Map;

public class DatabaseUpdateParams {
  private Boolean recursive;
  private Boolean hardDelete;

  public DatabaseUpdateParams() {}

  public Boolean getRecursive() {
    return recursive;
  }

  public DatabaseUpdateParams setRecursive(Boolean recursive) {
    this.recursive = recursive;
    return this;
  }

  public Boolean getHardDelete() {
    return hardDelete;
  }

  public DatabaseUpdateParams setHardDelete(Boolean hardDelete) {
    this.hardDelete = hardDelete;
    return this;
  }

  public Map<String, String> toQueryParams() {
    Map<String, String> params = new HashMap<>();
    if (recursive != null) params.put("recursive", recursive.toString());
    if (hardDelete != null) params.put("hardDelete", hardDelete.toString());
    return params;
  }

  public static Builder builder() {
    return new Builder();
  }

  public static class Builder {
    private final DatabaseUpdateParams params = new DatabaseUpdateParams();

    public Builder recursive(Boolean recursive) {
      params.setRecursive(recursive);
      return this;
    }

    public Builder hardDelete(Boolean hardDelete) {
      params.setHardDelete(hardDelete);
      return this;
    }

    public DatabaseUpdateParams build() {
      return params;
    }
  }
}
