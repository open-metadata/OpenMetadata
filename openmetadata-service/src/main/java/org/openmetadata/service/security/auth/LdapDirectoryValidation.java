/*
 *  Copyright 2026 Collate.
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

import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPException;
import java.security.GeneralSecurityException;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.system.StepValidation;

/**
 * The LDAP entry of the system status, shown on the Health Check page. It reaches the directory the
 * way login does, binds as the lookup account and reads the user base DN, and names the step that
 * failed.
 */
public final class LdapDirectoryValidation {
  private static final String NO_ATTRIBUTES = "1.1";

  private LdapDirectoryValidation() {}

  public static StepValidation validate(LdapConfiguration ldap) {
    try (LDAPConnection connection =
        LdapAuthenticator.openConnection(ldap, LdapAuthenticator.boundedConnectionOptions())) {
      return validateLookupAccount(connection, ldap);
    } catch (LDAPException | GeneralSecurityException e) {
      return failed(
          String.format(
              "Could not connect to %s:%s: %s", ldap.getHost(), ldap.getPort(), reasonOf(e)));
    }
  }

  private static StepValidation validateLookupAccount(
      LDAPConnection connection, LdapConfiguration ldap) {
    try {
      connection.bind(ldap.getDnAdminPrincipal(), ldap.getDnAdminPassword());
    } catch (LDAPException e) {
      return failed(
          String.format(
              "The directory rejected the lookup account '%s': %s",
              ldap.getDnAdminPrincipal(), reasonOf(e)));
    }
    return validateUserBaseDn(connection, ldap);
  }

  private static StepValidation validateUserBaseDn(
      LDAPConnection connection, LdapConfiguration ldap) {
    try {
      return connection.getEntry(ldap.getUserBaseDN(), NO_ATTRIBUTES) == null
          ? failed(
              String.format(
                  "The user base DN '%s' does not exist or the lookup account cannot read it",
                  ldap.getUserBaseDN()))
          : passed(ldap);
    } catch (LDAPException e) {
      return failed(
          String.format(
              "Could not read the user base DN '%s': %s", ldap.getUserBaseDN(), reasonOf(e)));
    }
  }

  private static StepValidation passed(LdapConfiguration ldap) {
    return new StepValidation()
        .withPassed(Boolean.TRUE)
        .withMessage(
            String.format(
                "Connected to %s:%s, bound as the lookup account and read the user base DN '%s'",
                ldap.getHost(), ldap.getPort(), ldap.getUserBaseDN()));
  }

  private static StepValidation failed(String message) {
    return new StepValidation().withPassed(Boolean.FALSE).withMessage(message);
  }

  /** The SDK wraps the useful reason, such as "Connection refused", in layers of its own text. */
  private static String reasonOf(Exception e) {
    return TestLoginService.rootMessage(ExceptionUtils.getRootCause(e));
  }
}
