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
package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.type.Include;

public class DaoListFilter extends ListFilter {
  public DaoListFilter() {
    super(Include.NON_DELETED);
  }

  public DaoListFilter(Include include) {
    super(include);
  }

  @Override
  public String getCondition() {
    return this.getCondition(null);
  }

  @Override
  public String getCondition(String tableName) {
    List<String> conditions = new ArrayList<>();
    String baseConditions = super.getCondition(tableName);
    conditions.add(baseConditions);
    conditions.add(getPageTypeCondition(tableName));
    return addCondition(conditions);
  }

  public String getPageTypeCondition(String tableName) {
    String pageType = this.queryParams.get("pageType");
    if (pageType == null) {
      return "";
    }
    String qualifiedColumn =
        (tableName == null || tableName.isBlank()) ? "pageType" : tableName + ".pageType";
    return qualifiedColumn + " = :pageType";
  }

  /** @deprecated use {@link #getPageTypeCondition(String)} instead. */
  @Deprecated
  public String getArticleCondition() {
    return getPageTypeCondition(null);
  }
}
