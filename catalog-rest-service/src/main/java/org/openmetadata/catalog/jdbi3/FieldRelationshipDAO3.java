/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;

public interface FieldRelationshipDAO3 {
  @SqlUpdate("INSERT IGNORE INTO field_relationship(fromFQN, toFQN, fromType, toType, relation) " +
          "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation)")
  void insert(@Bind("fromFQN") String fromFQN, @Bind("toFQN") String toFQN, @Bind("fromType") String fromType,
              @Bind("toType") String toType, @Bind("relation") int relation);

  @SqlUpdate("INSERT INTO field_relationship(fromFQN, toFQN, fromType, toType, relation, jsonSchema, json) " +
          "VALUES (:fromFQN, :toFQN, :fromType, :toType, :relation, :jsonSchema, :json) " +
          "ON DUPLICATE KEY UPDATE json = :json")
  void upsert(@Bind("fromFQN") String fromFQN, @Bind("toFQN") String toFQN, @Bind("fromType") String fromType,
              @Bind("toType") String toType, @Bind("relation") int relation,
              @Bind("jsonSchema") String jsonSchema, @Bind("json") String json);

  @SqlQuery("SELECT json FROM field_relationship WHERE " +
          "fromFQN = :fromFQN AND toFQN = :toFQN AND fromType = :fromType " +
          "AND toType = :toType AND relation = :relation")
  String find(@Bind("fromFQN") String fromFQN, @Bind("toFQN") String toFQN,
              @Bind("fromType") String fromType, @Bind("toType") String toType,
              @Bind("relation") int relation);

  @SqlQuery("SELECT fromFQN, toFQN, json FROM field_relationship WHERE " +
          "toFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType = :toType AND relation = :relation")
  @RegisterRowMapper(FromFieldMapper.class)
  List<List<String>> listFromByPrefix(@Bind("fqnPrefix") String fqnPrefix, @Bind("fromType") String fromType,
                                @Bind("toType") String toType, @Bind("relation") int relation);

  @SqlQuery("SELECT fromFQN, toFQN, json FROM field_relationship WHERE " +
          "fromFQN LIKE CONCAT(:fqnPrefix, '%') AND fromType = :fromType AND toType = :toType AND relation = :relation")
  @RegisterRowMapper(ToFieldMapper.class)
  List<List<String>> listToByPrefix(@Bind("fqnPrefix") String fqnPrefix, @Bind("fromType") String fromType,
                              @Bind("toType") String toType, @Bind("relation") int relation);

  @SqlUpdate("DELETE from field_relationship WHERE " +
          "(toFQN LIKE CONCAT(:fqnPrefix, '.%') OR fromFQN LIKE CONCAT(:fqnPrefix, '.%')) " +
          "AND relation = :relation")
  void deleteAllByPrefix(@Bind("fqnPrefix") String fqnPrefix, @Bind("relation") int relation);

  class ToFieldMapper implements RowMapper<List<String>> {
    @Override
    public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
      return Arrays.asList(rs.getString("fromFQN"), rs.getString("toFQN"), rs.getString("json"));
    }
  }

  class FromFieldMapper implements RowMapper<List<String>> {
    @Override
    public List<String> map(ResultSet rs, StatementContext ctx) throws SQLException {
      return Arrays.asList(rs.getString("toFQN"), rs.getString("fromFQN"), rs.getString("json"));
    }
  }
}