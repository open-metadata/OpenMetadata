/*
 *  Copyright 2021 Collate.
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

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.unboundid.ldap.sdk.Filter;
import com.unboundid.ldap.sdk.LDAPException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.auth.LdapConfiguration;

/**
 * Unit tests for {@link LdapAuthenticator}.
 *
 * <p>Focuses on the group membership filter construction logic introduced in
 * issue #26889 (recursive/nested Active Directory group membership support).
 *
 * <p>Tests validate both the standard equality filter (direct membership)
 * and the extensible match filter (recursive membership via
 * LDAP_MATCHING_RULE_IN_CHAIN OID 1.2.840.113556.1.4.1941).
 */
@ExtendWith(MockitoExtension.class)
class LdapAuthenticatorTest {

  private static final String TEST_USER_DN =
      "CN=John Doe,OU=Users,DC=example,DC=com";
  private static final String TEST_GROUP_MEMBER_ATTR = "member";
  private static final String EXPECTED_OID = "1.2.840.113556.1.4.1941";

  private LdapAuthenticator ldapAuthenticator;
  private LdapConfiguration ldapConfiguration;

  @BeforeEach
  void setUp() {
    ldapAuthenticator = new LdapAuthenticator();
    ldapConfiguration = mock(LdapConfiguration.class);
    when(ldapConfiguration.getGroupMemberAttributeName())
        .thenReturn(TEST_GROUP_MEMBER_ATTR);
  }

  @Nested
  @DisplayName("buildGroupMemberFilter() — recursive membership DISABLED")
  class WhenRecursiveMembershipIsDisabled {

    @BeforeEach
    void disableRecursiveMembership() {
      when(ldapConfiguration.getRecursiveGroupMembership()).thenReturn(Boolean.FALSE);
    }

    @Test
    @DisplayName("returns an equality filter when recursiveGroupMembership is false")
    void buildGroupMemberFilter_returnsEqualityFilter_whenRecursiveIsDisabled()
        throws LDAPException {
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter, "Filter must not be null");
      assertEquals(
          "member=" + TEST_USER_DN,
          filter.toString(),
          "Filter must be a simple equality filter matching member attribute");
      assertNull(
          filter.getMatchingRuleID(),
          "Equality filter must NOT have a matching rule ID (OID)");
    }

    @Test
    @DisplayName("equality filter attribute type matches groupMemberAttributeName")
    void buildGroupMemberFilter_equalityFilter_usesCorrectAttribute()
        throws LDAPException {
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter);
      assertEquals(
          TEST_GROUP_MEMBER_ATTR,
          filter.getAttributeName(),
          "Filter attribute must match groupMemberAttributeName from config");
    }

    @Test
    @DisplayName("equality filter assertion value matches userDn")
    void buildGroupMemberFilter_equalityFilter_usesCorrectUserDn()
        throws LDAPException {
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter);
      assertEquals(
          TEST_USER_DN,
          filter.getAssertionValue(),
          "Filter assertion value must match the provided userDn");
    }

    @Test
    @DisplayName("returns equality filter when recursiveGroupMembership is null")
    void buildGroupMemberFilter_returnsEqualityFilter_whenRecursiveIsNull()
        throws LDAPException {
      when(ldapConfiguration.getRecursiveGroupMembership()).thenReturn(null);

      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter, "Filter must not be null even when flag is null");
      assertNull(
          filter.getMatchingRuleID(),
          "Null flag must behave same as false — no OID in filter");
    }
  }


  @Nested
  @DisplayName("buildGroupMemberFilter() — recursive membership ENABLED")
  class WhenRecursiveMembershipIsEnabled {

    @BeforeEach
    void enableRecursiveMembership() {
      when(ldapConfiguration.getRecursiveGroupMembership()).thenReturn(Boolean.TRUE);
    }

    @Test
    @DisplayName("returns an extensible match filter when recursiveGroupMembership is true")
    void buildGroupMemberFilter_returnsExtensibleFilter_whenRecursiveIsEnabled()
        throws LDAPException {
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter, "Filter must not be null");
      assertNotNull(
          filter.getMatchingRuleID(),
          "Extensible match filter must have a matching rule ID (OID)");
      assertEquals(
          EXPECTED_OID,
          filter.getMatchingRuleID(),
          "Matching rule ID must be the AD LDAP_MATCHING_RULE_IN_CHAIN OID");
    }

    @Test
    @DisplayName("extensible filter attribute type matches groupMemberAttributeName")
    void buildGroupMemberFilter_extensibleFilter_usesCorrectAttribute()
        throws LDAPException {
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter);
      assertEquals(
          TEST_GROUP_MEMBER_ATTR,
          filter.getAttributeName(),
          "Extensible filter attribute must match groupMemberAttributeName");
    }

    @Test
    @DisplayName("extensible filter assertion value matches userDn")
    void buildGroupMemberFilter_extensibleFilter_usesCorrectUserDn()
        throws LDAPException {
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter);
      assertEquals(
          TEST_USER_DN,
          filter.getAssertionValue(),
          "Extensible filter assertion value must match the provided userDn");
    }

    @Test
    @DisplayName("extensible filter dnAttributes flag is false")
    void buildGroupMemberFilter_extensibleFilter_dnAttributesIsFalse()
        throws LDAPException {
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, TEST_USER_DN);

      assertNotNull(filter);
      assertEquals(
          false,
          filter.getDNAttributes(),
          "dnAttributes must be false — we match by value not DN components");
    }

    @Test
    @DisplayName("OID constant value is exactly 1.2.840.113556.1.4.1941")
    void adRecursiveGroupMatchingRule_constantValue_isCorrect() {
      assertEquals(
          "1.2.840.113556.1.4.1941",
          LdapAuthenticator.AD_RECURSIVE_GROUP_MATCHING_RULE,
          "OID constant must exactly match the AD LDAP_MATCHING_RULE_IN_CHAIN value");
    }
  }


  @Nested
  @DisplayName("buildGroupMemberFilter() — different userDn values")
  class WithDifferentUserDnValues {

    @BeforeEach
    void disableRecursiveMembership() {
      when(ldapConfiguration.getRecursiveGroupMembership()).thenReturn(Boolean.FALSE);
    }

    @Test
    @DisplayName("handles simple userDn correctly")
    void buildGroupMemberFilter_handlesSimpleUserDn() throws LDAPException {
      String simpleDn = "uid=johndoe,dc=example,dc=com";
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, simpleDn);

      assertNotNull(filter);
      assertEquals(simpleDn, filter.getAssertionValue());
    }

    @Test
    @DisplayName("handles complex nested userDn correctly")
    void buildGroupMemberFilter_handlesComplexUserDn() throws LDAPException {
      String complexDn =
          "CN=Jane Smith,OU=Engineering,OU=Teams,DC=corp,DC=example,DC=com";
      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, complexDn);

      assertNotNull(filter);
      assertEquals(complexDn, filter.getAssertionValue());
    }

    @Test
    @DisplayName("recursive filter handles complex userDn correctly")
    void buildGroupMemberFilter_recursiveFilter_handlesComplexUserDn()
        throws LDAPException {
      when(ldapConfiguration.getRecursiveGroupMembership()).thenReturn(Boolean.TRUE);
      String complexDn =
          "CN=Jane Smith,OU=Engineering,OU=Teams,DC=corp,DC=example,DC=com";

      Filter filter =
          ldapAuthenticator.buildGroupMemberFilter(ldapConfiguration, complexDn);

      assertNotNull(filter);
      assertEquals(EXPECTED_OID, filter.getMatchingRuleID());
      assertEquals(complexDn, filter.getAssertionValue());
    }
  }
}
