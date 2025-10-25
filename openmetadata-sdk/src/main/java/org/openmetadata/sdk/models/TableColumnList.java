package org.openmetadata.sdk.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import org.openmetadata.schema.type.Column;

/**
 * Response model for paginated table columns
 */
public class TableColumnList {
  @JsonProperty("data")
  private List<Column> data;

  @JsonProperty("paging")
  private PagingInfo paging;

  public List<Column> getData() {
    return data;
  }

  public void setData(List<Column> data) {
    this.data = data;
  }

  public PagingInfo getPaging() {
    return paging;
  }

  public void setPaging(PagingInfo paging) {
    this.paging = paging;
  }

  /**
   * Paging information for column list
   */
  public static class PagingInfo {
    @JsonProperty("total")
    private Integer total;

    @JsonProperty("offset")
    private Integer offset;

    @JsonProperty("limit")
    private Integer limit;

    @JsonProperty("after")
    private String after;

    @JsonProperty("before")
    private String before;

    public Integer getTotal() {
      return total;
    }

    public void setTotal(Integer total) {
      this.total = total;
    }

    public Integer getOffset() {
      return offset;
    }

    public void setOffset(Integer offset) {
      this.offset = offset;
    }

    public Integer getLimit() {
      return limit;
    }

    public void setLimit(Integer limit) {
      this.limit = limit;
    }

    public String getAfter() {
      return after;
    }

    public void setAfter(String after) {
      this.after = after;
    }

    public String getBefore() {
      return before;
    }

    public void setBefore(String before) {
      this.before = before;
    }
  }
}
