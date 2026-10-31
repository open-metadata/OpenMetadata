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

package org.openmetadata.service.secrets.masker;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.MCP_SERVER;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.ai.McpConnectionConfig;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestPreview;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

public final class McpServerMasker {
  private static final String CONNECTION_CONFIG = "connectionConfig";

  private McpServerMasker() {}

  public static McpServer mask(final McpServer server) {
    if (server != null) {
      maskConnectionConfig(server.getConnectionConfig());
      maskChangeDescription(server.getChangeDescription());
      maskChangeDescription(server.getIncrementalChangeDescription());
    }
    return server;
  }

  public static ChangeRequest maskChangeRequest(ChangeRequest request) {
    if (MCP_SERVER.equals(request.getEntityType())) {
      request = JsonUtils.deepCopy(request, ChangeRequest.class);
      if (request.getActiveRevision() != null) {
        maskOps(request.getActiveRevision().getOps());
      }
      listOrEmpty(request.getConflicts()).stream()
          .filter(conflict -> isConnectionField(conflict.getField()))
          .forEach(
              conflict -> {
                conflict.setBaseValue(maskJsonValue(conflict.getBaseValue()));
                conflict.setCurrentValue(maskJsonValue(conflict.getCurrentValue()));
                conflict.setProposedValue(maskJsonValue(conflict.getProposedValue()));
              });
    }
    return request;
  }

  public static ChangeRequestPreview maskPreview(ChangeRequestPreview preview) {
    if (MCP_SERVER.equals(preview.getEntityType())) {
      preview = JsonUtils.deepCopy(preview, ChangeRequestPreview.class);
      maskOps(preview.getOps());
    }
    return preview;
  }

  public static ChangeRevision maskRevision(String entityType, ChangeRevision revision) {
    if (MCP_SERVER.equals(entityType)) {
      revision = JsonUtils.deepCopy(revision, ChangeRevision.class);
      maskOps(revision.getOps());
    }
    return revision;
  }

  private static void maskOps(List<MutationOp> ops) {
    listOrEmpty(ops).stream()
        .filter(op -> isConnectionField(op.getField()))
        .forEach(
            op -> {
              op.setBaseValue(maskJsonValue(op.getBaseValue()));
              op.setValue(maskJsonValue(op.getValue()));
            });
  }

  private static String maskJsonValue(String value) {
    return value == null ? null : JsonUtils.pojoToJson(PASSWORD_MASK);
  }

  private static void maskConnectionConfig(final McpConnectionConfig config) {
    if (config == null) {
      return;
    }
    // Client configurations carry credentials under arbitrary environment names and arguments.
    if (config.getEnv() != null) {
      config.getEnv().getAdditionalProperties().replaceAll((name, value) -> PASSWORD_MASK);
    }
    if (config.getArgs() != null) {
      config.setArgs(config.getArgs().stream().map(argument -> PASSWORD_MASK).toList());
    }
    if (config.getUrl() != null) {
      config.setUrl(PASSWORD_MASK);
    }
  }

  public static void maskChangeDescription(final ChangeDescription changeDescription) {
    if (changeDescription != null) {
      Stream.of(
              changeDescription.getFieldsAdded(),
              changeDescription.getFieldsUpdated(),
              changeDescription.getFieldsDeleted())
          .flatMap(changes -> listOrEmpty(changes).stream())
          .forEach(McpServerMasker::maskFieldChange);
    }
  }

  private static void maskFieldChange(final FieldChange change) {
    if (isConnectionField(change.getName())) {
      if (change.getOldValue() != null) {
        change.setOldValue(PASSWORD_MASK);
      }
      if (change.getNewValue() != null) {
        change.setNewValue(PASSWORD_MASK);
      }
    }
  }

  private static boolean isConnectionField(String name) {
    return CONNECTION_CONFIG.equals(name)
        || (name != null && name.startsWith(CONNECTION_CONFIG + "."));
  }
}
