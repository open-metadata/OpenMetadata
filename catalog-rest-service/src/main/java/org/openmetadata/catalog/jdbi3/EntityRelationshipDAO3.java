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

import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.type.EntityReference;

import java.util.List;

public interface EntityRelationshipDAO3 {
  @SqlUpdate("INSERT IGNORE INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation) " +
          "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation)")
  int insert(@Bind("fromId") String fromId, @Bind("toId") String toId, @Bind("fromEntity") String fromEntity,
             @Bind("toEntity") String toEntity, @Bind("relation") int relation);

  //
  // Find to operations
  //
  @SqlQuery("SELECT toId, toEntity FROM entity_relationship WHERE fromId = :fromId AND relation = :relation")
  @RegisterRowMapper(ToEntityReferenceMapper3.class)
  List<EntityReference> findTo(@Bind("fromId") String fromId, @Bind("relation") int relation);

  @SqlQuery("SELECT toId FROM entity_relationship WHERE " +
          "fromId = :fromId AND relation = :relation AND toEntity = :toEntity ORDER BY fromId")
  List<String> findTo(@Bind("fromId") String fromId, @Bind("relation") int relation,
                      @Bind("toEntity") String toEntity);

  @SqlQuery("SELECT count(*) FROM entity_relationship WHERE " +
          "fromId = :fromId AND relation = :relation AND toEntity = :toEntity ORDER BY fromId")
  int findToCount(@Bind("fromId") String fromId, @Bind("relation") int relation, @Bind("toEntity") String toEntity);

  //
  // Find from operations
  //
  @SqlQuery("SELECT fromId FROM entity_relationship WHERE " +
          "toId = :toId AND relation = :relation AND fromEntity = :fromEntity ORDER BY fromId")
  List<String> findFrom(@Bind("toId") String toId, @Bind("relation") int relation,
                        @Bind("fromEntity") String fromEntity);

  @SqlQuery("SELECT fromId, fromEntity FROM entity_relationship WHERE toId = :toId AND relation = :relation " +
          "ORDER BY fromId")
  @RegisterRowMapper(FromEntityReferenceMapper3.class)
  List<EntityReference> findFrom(@Bind("toId") String toId, @Bind("relation") int relation);

  @SqlQuery("SELECT fromId, fromEntity FROM entity_relationship WHERE toId = :toId AND relation = :relation AND " +
          "fromEntity = :fromEntity ORDER BY fromId")
  @RegisterRowMapper(FromEntityReferenceMapper3.class)
  List<EntityReference> findFromEntity(@Bind("toId") String toId, @Bind("relation") int relation,
                                       @Bind("fromEntity") String fromEntity);

  //
  // Delete Operations
  //
  @SqlUpdate("DELETE from entity_relationship WHERE fromId = :fromId AND toId = :toId AND relation = :relation")
  void delete(@Bind("fromId") String fromId, @Bind("toId") String toId, @Bind("relation") int relation);

  // Delete all the entity relationship fromID --- relation --> entity of type toEntity
  @SqlUpdate("DELETE from entity_relationship WHERE fromId = :fromId AND relation = :relation AND toEntity = :toEntity")
  void deleteFrom(@Bind("fromId") String fromId, @Bind("relation") int relation, @Bind("toEntity") String toEntity);

  // Delete all the entity relationship fromID --- relation --> to any entity
  @SqlUpdate("DELETE from entity_relationship WHERE fromId = :fromId AND relation = :relation")
  void deleteFrom(@Bind("fromId") String fromId, @Bind("relation") int relation);

  // Delete all the entity relationship toId <-- relation --  entity of type fromEntity
  @SqlUpdate("DELETE from entity_relationship WHERE toId = :toId AND relation = :relation AND fromEntity = :fromEntity")
  void deleteTo(@Bind("toId") String toId, @Bind("relation") int relation, @Bind("fromEntity") String fromEntity);

  @SqlUpdate("DELETE from entity_relationship WHERE toId = :id OR fromId = :id")
  void deleteAll(@Bind("id") String id);
}
