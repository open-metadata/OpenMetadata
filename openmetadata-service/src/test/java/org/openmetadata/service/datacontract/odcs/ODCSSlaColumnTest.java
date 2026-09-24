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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ContractSLA;

class ODCSSlaColumnTest {
  private static final ODCSTableTarget TABLE =
      new ODCSTableTarget("snowflake.SALES.PUBLIC.orders", List.of("updated_at", "order.date"));

  @Test
  void columnNamedByItsOwnNameResolvesToItsFqn() {
    ContractSLA sla = new ContractSLA().withColumnName("UPDATED_AT");

    ODCSSlaColumn.resolve(sla, TABLE);

    assertEquals("snowflake.SALES.PUBLIC.orders.updated_at", sla.getColumnName());
  }

  @Test
  void columnAlreadyNamedByFqnIsKept() {
    ContractSLA sla =
        new ContractSLA().withColumnName("snowflake.SALES.PUBLIC.orders.\"order.date\"");

    ODCSSlaColumn.resolve(sla, TABLE);

    assertEquals("snowflake.SALES.PUBLIC.orders.\"order.date\"", sla.getColumnName());
  }

  @Test
  void columnTheTableDoesNotHaveIsDropped() {
    ContractSLA sla = new ContractSLA().withColumnName("loaded_at");

    ODCSSlaColumn.resolve(sla, TABLE);

    assertNull(sla.getColumnName());
  }

  @Test
  void elementIsTheColumnsOwnName() {
    assertEquals("updated_at", ODCSSlaColumn.toElement("snowflake.SALES.PUBLIC.orders.updated_at"));
    assertEquals(
        "order.date", ODCSSlaColumn.toElement("snowflake.SALES.PUBLIC.orders.\"order.date\""));
    assertEquals("updated_at", ODCSSlaColumn.toElement("updated_at"));
    assertNull(ODCSSlaColumn.toElement(null));
  }
}
