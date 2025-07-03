package org.openmetadata.service.migration.utils.v155;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class MigrationUtil {
  public static void updateUserNameToEmailPrefixForLdapAuthProvider(
      Handle handle,
      CollectionDAO daoCollection,
      AuthenticationConfiguration config,
      boolean postgres) {
    if (config.getProvider().equals(AuthProvider.LDAP)) {
      LOG.info("Starting migration username -> email prefix");
      int total = daoCollection.userDAO().listTotalCount();
      int offset = 0;
      int limit = 200;
      while (offset < total) {
        List<String> userEntities = daoCollection.userDAO().listAfterWithOffset(limit, offset);
        for (String json : userEntities) {
          User userEntity = JsonUtils.readValue(json, User.class);
          String email = userEntity.getEmail();
          String emailPrefix = email.substring(0, email.indexOf("@"));
          userEntity.setFullyQualifiedName(EntityInterfaceUtil.quoteName(emailPrefix));
          userEntity.setName(emailPrefix);

          daoCollection.userDAO().update(userEntity);
        }
        offset = offset + limit;
      }

      updateUserEntityNameHash(handle, postgres);
      LOG.info("Completed migrating username -> email prefix");
    }
  }

  public static void updateUserEntityNameHash(Handle handle, boolean postgres) {
    String updateNameHashSql;
    if (postgres) {
      updateNameHashSql = "UPDATE user_entity SET nameHash = MD5(json ->> 'fullyQualifiedName');";
    } else {
      updateNameHashSql =
          "UPDATE user_entity SET nameHash = MD5(JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')));";
    }

    try {
      handle.execute(updateNameHashSql);
      LOG.info("Successfully updated nameHash for all user entities.");
    } catch (Exception e) {
      LOG.error("Error updating nameHash field", e);
    }
  }
}
