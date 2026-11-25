package org.openmetadata.sdk.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Collections;
import java.util.List;
import org.openmetadata.schema.utils.ResultList;

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

  public ListResponse(ResultList<T> resultList) {
    if (resultList == null) {
      this.data = Collections.emptyList();
      return;
    }
    this.data = resultList.getData() != null ? resultList.getData() : Collections.emptyList();
    if (resultList.getPaging() != null) {
      this.paging =
          new AllModels.Paging()
              .withTotal(resultList.getPaging().getTotal())
              .withBefore(resultList.getPaging().getBefore())
              .withAfter(resultList.getPaging().getAfter());
    }
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
    if (paging != null && paging.getTotal() != null) {
      return paging.getTotal();
    }
    return data != null ? data.size() : 0;
  }
}
