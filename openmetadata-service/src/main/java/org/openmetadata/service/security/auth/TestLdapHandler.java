/*
 *  Copyright 2025 Collate
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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.unboundid.ldap.sdk.Filter;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionOptions;
import com.unboundid.ldap.sdk.SearchResult;
import com.unboundid.ldap.sdk.SearchResultEntry;
import com.unboundid.ldap.sdk.SearchScope;
import com.unboundid.util.ssl.SSLUtil;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.service.util.LdapUtil;

/**
 * Stateless LDAP Test Login handler. Accepts form-provided {@link LdapConfiguration}
 * + user credentials directly — does not use {@code SecurityConfigurationManager} or
 * any singleton, so it works BEFORE the config is saved. Does not create/update
 * users in the OpenMetadata database; purely verifies the LDAP config works.
 *
 * <p>Flow: admin bind → search user by mail attribute → bind as user to verify
 * password → read mail attribute value → return for UI auto-fill.
 */
@Slf4j
public final class TestLdapHandler {

  private static final int TIMEOUT_MS = 5000;

  private TestLdapHandler() {}

  public static Map<String, Object> handleLdapTestLogin(
      LdapConfiguration ldapConfig, String email, String password) {
    if (ldapConfig == null) {
      return error("LDAP configuration is required");
    }
    if (nullOrEmpty(email) || nullOrEmpty(password)) {
      return error("Email and password are required");
    }
    if (nullOrEmpty(ldapConfig.getHost())
        || ldapConfig.getPort() == null
        || nullOrEmpty(ldapConfig.getDnAdminPrincipal())
        || nullOrEmpty(ldapConfig.getDnAdminPassword())
        || nullOrEmpty(ldapConfig.getUserBaseDN())
        || nullOrEmpty(ldapConfig.getMailAttributeName())) {
      return error("LDAP configuration is missing required fields");
    }

    LDAPConnection adminConn = null;
    try {
      adminConn =
          buildConnection(
              ldapConfig, ldapConfig.getDnAdminPrincipal(), ldapConfig.getDnAdminPassword());

      String userDn = searchUserDn(adminConn, ldapConfig, email);
      if (userDn == null) {
        return error(
            "User '" + email + "' not found in LDAP directory under " + ldapConfig.getUserBaseDN());
      }

      // Verify the user's password via bind
      try (LDAPConnection userConn = buildConnection(ldapConfig, userDn, password)) {
        // bind success = password valid
      } catch (Exception e) {
        return error("Invalid username or password");
      }

      String mail = readAttribute(adminConn, userDn, ldapConfig.getMailAttributeName());
      if (nullOrEmpty(mail)) {
        mail = email;
      }

      Map<String, Object> result = new LinkedHashMap<>();
      result.put("success", true);
      result.put("email", mail);
      result.put("username", extractCn(userDn));
      result.put("derivedPrincipalDomain", mail.contains("@") ? mail.split("@")[1] : "");
      result.put("suggestedAdminPrincipal", mail);
      return result;
    } catch (Exception e) {
      LOG.error("[LDAP Test Login] failed", e);
      return error("LDAP test failed: " + e.getMessage());
    } finally {
      if (adminConn != null) {
        adminConn.close();
      }
    }
  }

  private static LDAPConnection buildConnection(
      LdapConfiguration ldapConfig, String bindDn, String bindPassword) throws Exception {
    LDAPConnectionOptions options = new LDAPConnectionOptions();
    options.setConnectTimeoutMillis(TIMEOUT_MS);
    options.setResponseTimeoutMillis(TIMEOUT_MS);

    if (Boolean.TRUE.equals(ldapConfig.getSslEnabled())) {
      LdapUtil ldapUtil = new LdapUtil();
      SSLUtil sslUtil = new SSLUtil(ldapUtil.getLdapSSLConnection(ldapConfig, options));
      return new LDAPConnection(
          sslUtil.createSSLSocketFactory(),
          options,
          ldapConfig.getHost(),
          ldapConfig.getPort(),
          bindDn,
          bindPassword);
    }
    return new LDAPConnection(
        options, ldapConfig.getHost(), ldapConfig.getPort(), bindDn, bindPassword);
  }

  private static String searchUserDn(
      LDAPConnection conn, LdapConfiguration ldapConfig, String email) throws Exception {
    Filter filter = Filter.createEqualityFilter(ldapConfig.getMailAttributeName(), email);
    SearchResult result = conn.search(ldapConfig.getUserBaseDN(), SearchScope.SUB, filter, "dn");
    if (result.getEntryCount() == 0) {
      return null;
    }
    return result.getSearchEntries().get(0).getDN();
  }

  private static String readAttribute(LDAPConnection conn, String userDn, String attribute)
      throws Exception {
    SearchResultEntry entry = conn.getEntry(userDn, attribute);
    if (entry == null) {
      return null;
    }
    return entry.getAttributeValue(attribute);
  }

  private static String extractCn(String dn) {
    if (nullOrEmpty(dn)) {
      return "";
    }
    for (String part : dn.split(",")) {
      String trimmed = part.trim();
      if (trimmed.toLowerCase().startsWith("cn=")) {
        return trimmed.substring(3);
      }
    }
    return dn;
  }

  private static Map<String, Object> error(String message) {
    return Map.of("success", false, "error", message);
  }
}
