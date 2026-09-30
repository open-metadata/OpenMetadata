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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigInteger;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfInferenceRuleDAO.RdfInferenceRuleRow;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfInferenceRuleDAO.RdfInferenceRuleRowMapper;

class RdfInferenceRuleRowMapperTest {
  private static final long MATERIALIZED_AT = 1_790_171_100_152L;

  @Test
  void readsMysqlUnsignedMaterializationTimestamp() throws SQLException {
    // MySQL declares lastMaterializedAt BIGINT UNSIGNED, which Connector/J boxes as BigInteger.
    final ResultSet resultSet = ruleRow();
    when(resultSet.getObject("lastMaterializedAt")).thenReturn(BigInteger.valueOf(MATERIALIZED_AT));
    when(resultSet.getObject("lastMaterializedAt", Long.class)).thenReturn(MATERIALIZED_AT);

    final RdfInferenceRuleRow row = new RdfInferenceRuleRowMapper().map(resultSet, null);

    assertEquals(MATERIALIZED_AT, row.lastMaterializedAt());
  }

  @Test
  void keepsNeverMaterializedRuleWithoutTimestamp() throws SQLException {
    final ResultSet resultSet = ruleRow();

    final RdfInferenceRuleRow row = new RdfInferenceRuleRowMapper().map(resultSet, null);

    assertNull(row.lastMaterializedAt());
  }

  private static ResultSet ruleRow() throws SQLException {
    final ResultSet resultSet = mock(ResultSet.class);
    when(resultSet.getString("name")).thenReturn("transitive-lineage-closure");
    when(resultSet.getString("json")).thenReturn("{}");
    when(resultSet.getBoolean("systemRule")).thenReturn(true);
    when(resultSet.getLong("updatedAt")).thenReturn(MATERIALIZED_AT);
    return resultSet;
  }
}
