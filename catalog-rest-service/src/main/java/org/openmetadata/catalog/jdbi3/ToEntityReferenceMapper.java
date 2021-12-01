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

package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.core.mapper.RowMapper;
import org.openmetadata.catalog.type.EntityReference;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

public class ToEntityReferenceMapper implements RowMapper<EntityReference> {
  @Override
  public EntityReference map(ResultSet rs, org.jdbi.v3.core.statement.StatementContext ctx) throws SQLException {
    return new EntityReference().withId(UUID.fromString(rs.getString("toId"))).withType(rs.getString("toEntity"));
  }
}
