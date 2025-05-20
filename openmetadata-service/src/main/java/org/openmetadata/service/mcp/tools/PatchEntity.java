package org.openmetadata.service.mcp.tools;

import java.util.Map;
import javax.json.JsonPatch;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class PatchEntity {
  public static Map<String, Object> execute(Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String entityFqn = (String) params.get("entityFqn");
    JsonPatch patch = JsonUtils.readOrConvertValue(params.get("patch"), JsonPatch.class);

    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    RestUtil.PatchResponse<? extends EntityInterface> response =
        repository.patch(null, entityFqn, "admin", patch, ChangeSource.MANUAL);
    return JsonUtils.convertValue(response, Map.class);
  }
}
