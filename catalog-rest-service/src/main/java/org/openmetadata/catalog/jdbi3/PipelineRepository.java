/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.io.IOException;
import java.util.List;

public abstract class PipelineRepository {
  @CreateSqlObject
  abstract PipelineDAO pipelineDAO();

  public void create(String json) {
    pipelineDAO().insert(json);
  }

  public Pipeline get(String id) throws IOException {
    return EntityUtil.validate(id, pipelineDAO().findById(id), Pipeline.class);
  }

  public List<Pipeline> list(String name) throws IOException {
    return JsonUtils.readObjects(pipelineDAO().list(name), Pipeline.class);
  }

  public interface PipelineDAO {
    @SqlUpdate("INSERT INTO pipeline_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM pipeline_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM pipeline_entity WHERE (name = :name OR :name is NULL)")
    List<String> list(@Bind("name") String name);
  }
}
