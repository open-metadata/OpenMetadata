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

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

public interface EntityExtensionDAO {
  @SqlUpdate("REPLACE INTO entity_extension(id, extension, jsonSchema, json) " +
          "VALUES (:id, :extension, :jsonSchema, :json)")
  void insert(@Bind("id") String id, @Bind("extension") String extension, @Bind("jsonSchema") String jsonSchema,
             @Bind("json") String json);

  @SqlQuery("SELECT json FROM entity_extension WHERE id = :id AND extension = :extension")
  String getExtension(@Bind("id") String id, @Bind("extension") String extension);
}