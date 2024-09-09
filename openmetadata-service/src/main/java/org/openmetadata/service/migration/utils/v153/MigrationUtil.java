package org.openmetadata.service.migration.utils.v153;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {

  public static void updateEmailTemplates(CollectionDAO collectionDAO) {
    CollectionDAO.DocStoreDAO dao = collectionDAO.docStoreDAO();
    // delete emailTemplates, it will be loaded from initSeedData.
    dao.deleteEmailTemplates();
  }

  public static void updateUserNameToEmailPrefixForLdapAuthProvider(
      CollectionDAO daoCollection, AuthenticationConfiguration config) {
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
          userEntity.setFullyQualifiedName(emailPrefix);

          daoCollection.userDAO().update(userEntity);
        }
        offset = offset + limit;
      }
      LOG.info("Completed migrating username -> email prefix");
    }
  }
}
