/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.datacontract.odcs;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The column holding the data's refresh time. The contract SLA names it by FQN, which is how the UI
 * picks and shows it; an ODCS SLA element names it by the column's own name.
 */
public final class ODCSSlaColumn {

  private ODCSSlaColumn() {}

  /** Points the SLA at the table's column, or at none when the table has no such column. */
  public static void resolve(ContractSLA sla, ODCSTableTarget table) {
    if (sla != null && sla.getColumnName() != null) {
      sla.setColumnName(table.resolveColumnFqn(sla.getColumnName()).orElse(null));
    }
  }

  public static String toElement(String columnName) {
    String element = null;
    if (!nullOrEmpty(columnName)) {
      String[] parts = FullyQualifiedName.split(columnName);
      element = FullyQualifiedName.unquoteName(parts[parts.length - 1]);
    }
    return element;
  }
}
