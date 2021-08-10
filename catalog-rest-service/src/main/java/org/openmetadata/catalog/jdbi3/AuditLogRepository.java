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

import org.openmetadata.catalog.type.AuditLog;
import org.openmetadata.catalog.util.EntityUtil;

import org.openmetadata.catalog.util.JsonUtils;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public abstract class AuditLogRepository {
  public static final Logger LOG = LoggerFactory.getLogger(AuditLogRepository.class);

  @CreateSqlObject
  abstract AuditLogDAO auditLogDAO();


  @Transaction
  public List<AuditLog> list() throws IOException {
    List<String> jsons = auditLogDAO().list();
    List<AuditLog> auditLogs = new ArrayList<>();
    for (String json : jsons) {
      auditLogs.add(JsonUtils.readValue(json, AuditLog.class));
    }
    return auditLogs;
  }

  @Transaction
  public AuditLog get(String id) throws IOException {
    return EntityUtil.validate(id, auditLogDAO().findById(id), AuditLog.class);
  }

  @Transaction
  public List<AuditLog> getByEntityType(String entityType) throws IOException {
    List<String> jsons = auditLogDAO().findByEntityType(entityType);
    List<AuditLog> auditLogs = new ArrayList<>();
    for (String json: jsons) {
      auditLogs.add(JsonUtils.readValue(json, AuditLog.class));
    }
    return auditLogs;
  }

  @Transaction
  public AuditLog create(AuditLog auditLog) throws IOException {
    auditLogDAO().insert(JsonUtils.pojoToJson(auditLog));
    return auditLog;
  }

  @Transaction
  public void delete(String id) throws IOException {
    auditLogDAO().delete(id);
  }


  public interface AuditLogDAO {
    @SqlUpdate("INSERT INTO audit_log (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM audit_log WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM audit_log WHERE entity_type = :entity_type")
    List<String> findByEntityType(@Bind("entity_type") String entityType);

    @SqlQuery("SELECT json FROM audit_log")
    List<String> list();

    @SqlUpdate("UPDATE audit_log_entity SET json = :json WHERE id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlUpdate("DELETE FROM audit_log_entity WHERE id = :id")
    int delete(@Bind("id") String id);

  }
}