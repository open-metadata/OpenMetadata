package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LdapConfiguration;

public class SystemRepositoryLdapConfigTest {

  private void ensureLdapConfigDefaultValues(LdapConfiguration ldapConfig) {
    if (ldapConfig == null) {
      return;
    }

    if (ldapConfig.getGroupAttributeName() == null) {
      ldapConfig.setGroupAttributeName("");
    }
    if (ldapConfig.getGroupAttributeValue() == null) {
      ldapConfig.setGroupAttributeValue("");
    }
    if (ldapConfig.getGroupMemberAttributeName() == null) {
      ldapConfig.setGroupMemberAttributeName("");
    }
    if (ldapConfig.getGroupBaseDN() == null) {
      ldapConfig.setGroupBaseDN("");
    }

    if (ldapConfig.getRoleAdminName() == null) {
      ldapConfig.setRoleAdminName("");
    }
    if (ldapConfig.getAllAttributeName() == null) {
      ldapConfig.setAllAttributeName("");
    }
    if (ldapConfig.getAuthRolesMapping() == null) {
      ldapConfig.setAuthRolesMapping("");
    }
  }

  @Test
  void testEnsureLdapConfigDefaultValues_NullConfig() {
    ensureLdapConfigDefaultValues(null);
  }

  @Test
  void testEnsureLdapConfigDefaultValues_AllFieldsNull() {
    LdapConfiguration ldapConfig = new LdapConfiguration();

    ensureLdapConfigDefaultValues(ldapConfig);

    assertNotNull(ldapConfig.getGroupAttributeName());
    assertEquals("", ldapConfig.getGroupAttributeName());

    assertNotNull(ldapConfig.getGroupAttributeValue());
    assertEquals("", ldapConfig.getGroupAttributeValue());

    assertNotNull(ldapConfig.getGroupMemberAttributeName());
    assertEquals("", ldapConfig.getGroupMemberAttributeName());

    assertNotNull(ldapConfig.getGroupBaseDN());
    assertEquals("", ldapConfig.getGroupBaseDN());

    assertNotNull(ldapConfig.getRoleAdminName());
    assertEquals("", ldapConfig.getRoleAdminName());

    assertNotNull(ldapConfig.getAllAttributeName());
    assertEquals("", ldapConfig.getAllAttributeName());

    assertNotNull(ldapConfig.getAuthRolesMapping());
    assertEquals("", ldapConfig.getAuthRolesMapping());
  }

  @Test
  void testEnsureLdapConfigDefaultValues_SomeFieldsNull() {
    LdapConfiguration ldapConfig = new LdapConfiguration();
    ldapConfig.setGroupAttributeName("memberOf");
    ldapConfig.setRoleAdminName("admin");

    ensureLdapConfigDefaultValues(ldapConfig);

    assertEquals("memberOf", ldapConfig.getGroupAttributeName());
    assertEquals("admin", ldapConfig.getRoleAdminName());

    assertEquals("", ldapConfig.getGroupAttributeValue());
    assertEquals("", ldapConfig.getGroupMemberAttributeName());
    assertEquals("", ldapConfig.getGroupBaseDN());
    assertEquals("", ldapConfig.getAllAttributeName());
    assertEquals("", ldapConfig.getAuthRolesMapping());
  }

  @Test
  void testEnsureLdapConfigDefaultValues_AllFieldsPopulated() {
    LdapConfiguration ldapConfig = new LdapConfiguration();
    ldapConfig.setGroupAttributeName("memberOf");
    ldapConfig.setGroupAttributeValue("OpenMetadata");
    ldapConfig.setGroupMemberAttributeName("member");
    ldapConfig.setGroupBaseDN("ou=groups,dc=example,dc=com");
    ldapConfig.setRoleAdminName("admin");
    ldapConfig.setAllAttributeName("*");
    ldapConfig.setAuthRolesMapping("{\"admin\": [\"Admin\"]}");

    ensureLdapConfigDefaultValues(ldapConfig);

    assertEquals("memberOf", ldapConfig.getGroupAttributeName());
    assertEquals("OpenMetadata", ldapConfig.getGroupAttributeValue());
    assertEquals("member", ldapConfig.getGroupMemberAttributeName());
    assertEquals("ou=groups,dc=example,dc=com", ldapConfig.getGroupBaseDN());
    assertEquals("admin", ldapConfig.getRoleAdminName());
    assertEquals("*", ldapConfig.getAllAttributeName());
    assertEquals("{\"admin\": [\"Admin\"]}", ldapConfig.getAuthRolesMapping());
  }

  @Test
  void testEnsureLdapConfigDefaultValues_EmptyStringsNotOverwritten() {
    LdapConfiguration ldapConfig = new LdapConfiguration();
    ldapConfig.setGroupAttributeName("");
    ldapConfig.setRoleAdminName("");

    ensureLdapConfigDefaultValues(ldapConfig);

    assertEquals("", ldapConfig.getGroupAttributeName());
    assertEquals("", ldapConfig.getRoleAdminName());
  }

  @Test
  void testEnsureLdapConfigDefaultValues_GroupFieldsDefaults() {
    LdapConfiguration ldapConfig = new LdapConfiguration();

    ensureLdapConfigDefaultValues(ldapConfig);

    assertEquals("", ldapConfig.getGroupAttributeName());
    assertEquals("", ldapConfig.getGroupAttributeValue());
    assertEquals("", ldapConfig.getGroupMemberAttributeName());
    assertEquals("", ldapConfig.getGroupBaseDN());
  }

  @Test
  void testEnsureLdapConfigDefaultValues_OtherOptionalFieldsDefaults() {
    LdapConfiguration ldapConfig = new LdapConfiguration();

    ensureLdapConfigDefaultValues(ldapConfig);

    assertEquals("", ldapConfig.getRoleAdminName());
    assertEquals("", ldapConfig.getAllAttributeName());
    assertEquals("", ldapConfig.getAuthRolesMapping());
  }
}
