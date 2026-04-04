package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.unboundid.ldap.sdk.Filter;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LdapConfiguration;

class LdapAuthenticatorTest {

  @Test
  void buildGroupMemberFilterUsesEqualityWhenRecursiveMembershipIsDisabled() {
    LdapConfiguration ldapConfiguration = new LdapConfiguration();
    ldapConfiguration.setGroupMemberAttributeName("member");
    ldapConfiguration.setRecursiveGroupMembership(false);

    Filter filter =
        LdapAuthenticator.buildGroupMemberFilter(
            ldapConfiguration, "cn=john,ou=users,dc=example,dc=com");

    assertEquals(Filter.FILTER_TYPE_EQUALITY, filter.getFilterType());
    assertEquals("member", filter.getAttributeName());
    assertEquals("cn=john,ou=users,dc=example,dc=com", filter.getAssertionValue());
    assertFalse(filter.getDNAttributes());
    assertTrue(filter.getMatchingRuleID() == null);
  }

  @Test
  void buildGroupMemberFilterUsesRecursiveMatchRuleWhenEnabled() {
    LdapConfiguration ldapConfiguration = new LdapConfiguration();
    ldapConfiguration.setGroupMemberAttributeName("member");
    ldapConfiguration.setRecursiveGroupMembership(true);

    Filter filter =
        LdapAuthenticator.buildGroupMemberFilter(
            ldapConfiguration, "cn=john,ou=users,dc=example,dc=com");

    assertEquals(Filter.FILTER_TYPE_EXTENSIBLE_MATCH, filter.getFilterType());
    assertEquals("member", filter.getAttributeName());
    assertEquals("1.2.840.113556.1.4.1941", filter.getMatchingRuleID());
    assertEquals("cn=john,ou=users,dc=example,dc=com", filter.getAssertionValue());
    assertFalse(filter.getDNAttributes());
  }
}
