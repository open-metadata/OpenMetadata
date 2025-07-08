/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.Paging;

/**
 * Class used for generating JSON response for APIs returning list of objects in the following format: { "data" : [ {
 * json for object 1}, {json for object 2}, ... ] }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({"data"})
public class ResultList<T> {

  @JsonProperty("data")
  @NotNull
  private List<T> data;

  @JsonProperty("paging")
  private Paging paging;

  @JsonProperty("errors")
  private List<EntityError> errors;

  public ResultList() {}

  public ResultList(List<T> data) {
    this.data = data;
    this.paging = null;
    this.errors = null;
  }

  /**
   * Cursor functionality. User has request 'limit' number of entries. The data provided must have 'limit' + 1 number of
   * entries.
   *
   * <p>--------------------------------------------------------------------------------------------------------------
   * Consider forward scrolling:
   * --------------------------------------------------------------------------------------------------------------
   * Query GET .../entities?limit=pagesize CASE 0: No before or after parameters in the query Returns: page1
   * beforeCursor = null, -> Indicates first page afterCursor = last record in page1
   *
   * <p>Query GET .../entities?limit=pagesize&after={last record in page1} Returns: page2 beforeCursor = first record in
   * page2 afterCursor = last record in page2
   *
   * <p>Query GET .../entities?limit=pagesize&after={last record in page2} CASE 1: Page 3 has less than limit number of
   * entries and hence partial page is returned Returns: partial page 3 beforeCursor = first record in page3 afterCursor
   * = null -------- FORWARD SCROLLING ENDS -------------
   *
   * <p>CASE 2: Page 3 has exactly page number of entries and not entries to follow after Returns: page3 beforeCursor =
   * first record in page3 afterCursor = null -------- FORWARD SCROLLING ENDS -------------
   *
   * <p>--------------------------------------------------------------------------------------------------------------
   * Consider backward scrolling from the previous state:
   * --------------------------------------------------------------------------------------------------------------
   *
   * <p>Query GET .../entities?limit=pagesize&before={last record in page2 + 1} Returns: page2 beforeCursor = first
   * record in page2 afterCursor = last record in page2
   *
   * <p>Query GET .../entities?limit=pagesize&before={first record page 2} CASE 3: Page 1 does not have {@code limit}
   * number entries and hence partial page is returned Returns: page1 beforeCursor = null afterCursor = last record in
   * page1 -------- BACKWARD SCROLLING ENDS -------------
   *
   * <p>CASE 4: Page 1 has exactly page number of entries Returns: page1 beforeCursor = null afterCursor = Empty string
   * to start at page1 -------- BACKWARD SCROLLING ENDS -------------
   */
  public ResultList(List<T> data, String beforeCursor, String afterCursor, int total) {
    this.data = data;
    paging =
        new Paging()
            .withBefore(RestUtil.encodeCursor(beforeCursor))
            .withAfter(RestUtil.encodeCursor(afterCursor))
            .withTotal(total);
  }

  public ResultList(List<T> data, Integer offset, int total) {
    this.data = data;
    paging = new Paging().withBefore(null).withAfter(null).withTotal(total).withOffset(offset);
  }

  /* Conveniently map the data to another type without the need to create a new ResultList */
  public <S> ResultList<S> map(Function<T, S> mapper) {
    return new ResultList<>(data.stream().map(mapper).collect(Collectors.toList()), paging);
  }

  /* Conveniently filter the data without the need to create a new ResultList */
  public ResultList<T> filter(Predicate<T> predicate) {
    return new ResultList<>(data.stream().filter(predicate).collect(Collectors.toList()), paging);
  }

  public ResultList(List<T> data, Integer offset, Integer limit, Integer total) {
    this.data = data;
    paging =
        new Paging()
            .withBefore(null)
            .withAfter(null)
            .withTotal(total)
            .withOffset(offset)
            .withLimit(limit);
  }

  public ResultList(List<T> data, Paging other) {
    this.data = data;
    paging =
        new Paging()
            .withBefore(null)
            .withAfter(null)
            .withTotal(other.getTotal())
            .withOffset(other.getOffset())
            .withLimit(other.getLimit());
  }

  public ResultList(
      List<T> data, List<EntityError> errors, String beforeCursor, String afterCursor, int total) {
    this.data = data;
    this.errors = errors;
    paging =
        new Paging()
            .withBefore(RestUtil.encodeCursor(beforeCursor))
            .withAfter(RestUtil.encodeCursor(afterCursor))
            .withTotal(total);
  }

  @JsonProperty("data")
  public List<T> getData() {
    return data;
  }

  @JsonProperty("data")
  public void setData(List<T> data) {
    this.data = data;
  }

  @JsonProperty("errors")
  public List<EntityError> getErrors() {
    return errors;
  }

  @JsonProperty("errors")
  public void setErrors(List<EntityError> data) {
    this.errors = data;
  }

  @JsonProperty("paging")
  public Paging getPaging() {
    return paging;
  }

  @JsonProperty("paging")
  public ResultList<T> setPaging(Paging paging) {
    this.paging = paging;
    return this;
  }
}
