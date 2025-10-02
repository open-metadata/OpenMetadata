package org.openmetadata.sdk.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ListResponse<T> {
  private List<T> data;
  private AllModels.Paging paging;

  public ListResponse() {}

  public ListResponse(List<T> data) {
    this.data = data;
  }

  public ListResponse(List<T> data, AllModels.Paging paging) {
    this.data = data;
    this.paging = paging;
  }

  public List<T> getData() {
    return data;
  }

  public void setData(List<T> data) {
    this.data = data;
  }

  public AllModels.Paging getPaging() {
    return paging;
  }

  public void setPaging(AllModels.Paging paging) {
    this.paging = paging;
  }

  public boolean hasNextPage() {
    return paging != null && paging.getAfter() != null;
  }

  public boolean hasPreviousPage() {
    return paging != null && paging.getBefore() != null;
  }

  public int getTotal() {
    return paging != null ? paging.getTotal() : (data != null ? data.size() : 0);
  }
}
