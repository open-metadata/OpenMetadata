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

package org.openmetadata.catalog.util;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import org.openmetadata.catalog.type.Paging;
import org.openmetadata.common.utils.CipherText;

import javax.validation.constraints.NotNull;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.List;

/**
 * Class used for generating JSON response for APIs returning list of objects
 * in the following format:
 * {
 * "data" : [
 * { json for object 1}, {json for object 2}, ...
 * ]
 * }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({"data"})
public class ResultList<T> {

  @JsonProperty("data")
  @NotNull
  private List<T> data;

  @JsonProperty("paging")
  private Paging paging;

  public ResultList() {}

  public ResultList(List<T> data) {
    this.data = data;
    this.paging = null;
  }

  /**
   * Cursor functionality.
   * User has request 'limit' number of entries. The data provided must have 'limit' + 1 number of entries.
   *
   * --------------------------------------------------------------------------------------------------------------
   * Consider forward scrolling:
   * --------------------------------------------------------------------------------------------------------------
   * Query GET .../entities?limit=pagesize
   * CASE 0: No before or after parameters in the query
   * Returns: page1
   *          beforeCursor = null,   -> Indicates first page
   *          afterCursor = last record in page1
   *
   * Query GET .../entities?limit=pagesize&after={last record in page1}
   * Returns: page2
   *          beforeCursor = first record in page2
   *          afterCursor = last record in page2
   *
   * Query GET .../entities?limit=pagesize&after={last record in page2}
   * CASE 1: Page 3 has less than limit number of entries and hence partial page is returned
   * Returns: partial page 3
   *          beforeCursor = first record in page3
   *          afterCursor = null
   *          -------- FORWARD SCROLLING ENDS -------------
   *
   * CASE 2: Page 3 has exactly page number of entries and not entries to follow after
   * Returns: page3
   *          beforeCursor = first record in page3
   *          afterCursor = null
   *          -------- FORWARD SCROLLING ENDS -------------
   *
   * --------------------------------------------------------------------------------------------------------------
   * Consider backward scrolling from the previous state:
   * --------------------------------------------------------------------------------------------------------------
   *
   * Query GET .../entities?limit=pagesize&before={last record in page2 + 1}
   * Returns: page2
   *          beforeCursor = first record in page2
   *          afterCursor = last record in page2
   *
   * Query GET .../entities?limit=pagesize&before={first record page 2}
   * CASE 3: Page 1 does not have {@code limit} number entries and hence partial page is returned
   * Returns: page1
   *          beforeCursor = null
   *          afterCursor = last record in page1
   *          -------- BACKWARD SCROLLING ENDS -------------
   *
   * CASE 4: Page 1 has exactly page number of entries
   * Returns: page1
   *          beforeCursor = null
   *          afterCursor = Empty string to start at page1
   *          -------- BACKWARD SCROLLING ENDS -------------
   *
   */
  public ResultList(List<T> data, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException,
          UnsupportedEncodingException {
    this.data = data;
    paging = new Paging().withBefore(CipherText.instance().encrypt(beforeCursor))
                    .withAfter(CipherText.instance().encrypt(afterCursor)).withTotal(total);
  }

  @JsonProperty("data")
  public List<T> getData() {
    return data;
  }

  @JsonProperty("data")
  public void setData(List<T> data) {
    this.data = data;
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
