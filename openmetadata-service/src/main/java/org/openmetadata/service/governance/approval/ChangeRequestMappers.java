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

package org.openmetadata.service.governance.approval;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeApplication;
import org.openmetadata.schema.governance.changeRequest.ChangeLifecycleEvent;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.schema.utils.JsonUtils;

/** Row mappers for the change request tables; delivery fields live only in columns. */
public final class ChangeRequestMappers {
  private ChangeRequestMappers() {}

  public static final class ChangeRequestMapper implements RowMapper<ChangeRequest> {
    @Override
    public ChangeRequest map(ResultSet rs, StatementContext ctx) throws SQLException {
      return JsonUtils.readValue(rs.getString("json"), ChangeRequest.class)
          .withDeliveryStatus(DeliveryStatus.fromValue(rs.getString("deliveryStatus")))
          .withDeliveryAttempts(rs.getInt("deliveryAttempts"));
    }
  }

  public static final class ChangeRevisionMapper implements RowMapper<ChangeRevision> {
    @Override
    public ChangeRevision map(ResultSet rs, StatementContext ctx) throws SQLException {
      return JsonUtils.readValue(rs.getString("json"), ChangeRevision.class);
    }
  }

  public static final class ApprovalDecisionMapper implements RowMapper<ApprovalDecision> {
    @Override
    public ApprovalDecision map(ResultSet rs, StatementContext ctx) throws SQLException {
      return JsonUtils.readValue(rs.getString("json"), ApprovalDecision.class);
    }
  }

  public static final class ChangeLifecycleEventMapper implements RowMapper<ChangeLifecycleEvent> {
    @Override
    public ChangeLifecycleEvent map(ResultSet rs, StatementContext ctx) throws SQLException {
      return JsonUtils.readValue(rs.getString("json"), ChangeLifecycleEvent.class);
    }
  }

  public static final class ChangeApplicationMapper implements RowMapper<ChangeApplication> {
    @Override
    public ChangeApplication map(ResultSet rs, StatementContext ctx) throws SQLException {
      return JsonUtils.readValue(rs.getString("json"), ChangeApplication.class);
    }
  }
}
