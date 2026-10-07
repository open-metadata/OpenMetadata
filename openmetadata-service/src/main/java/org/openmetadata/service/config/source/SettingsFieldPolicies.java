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

package org.openmetadata.service.config.source;

import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.settings.SettingsType;

/** The reconciliation policy of every setting that lives both in the deployment and the DB. */
public final class SettingsFieldPolicies {
  private static final SettingsFieldPolicy AUTHENTICATION =
      SettingsFieldPolicy.builder()
          .hasIdentityProvider(true)
          // Jetty's session cookie is configured once at startup from this flag.
          .deploymentOwned("/forceSecureSessionCookie")
          .identity("/provider")
          .identity("/clientType")
          .identity("/authority")
          .identity("/clientId")
          .identity("/oidcConfiguration/id")
          .identity("/oidcConfiguration/discoveryUri")
          .identity("/samlConfiguration/idp/entityId")
          .identity("/ldapConfiguration/host")
          .idpDependent("/oidcConfiguration")
          .idpDependent("/samlConfiguration")
          .idpDependent("/ldapConfiguration")
          .idpDependent("/responseType")
          .idpDependent("/providerName")
          .idpDependent("/callbackUrl")
          .idpDependent("/tokenValidationAlgorithm")
          .idpDependent("/publicKeyUrls")
          // Claims only exist in tokens of the provider they were mapped for.
          .group(
              new FieldGroup(
                  "claims",
                  List.of(
                      "/jwtPrincipalClaims",
                      "/jwtPrincipalClaimsMapping",
                      "/jwtTeamClaimMapping",
                      "/emailClaim",
                      "/displayNameClaim"),
                  UnitKind.IDP_DEPENDENT))
          // Half a role mapping strips roles from users at their next login.
          .group(
              new FieldGroup(
                  "ldapRoles",
                  List.of(
                      "/ldapConfiguration/authRolesMapping",
                      "/ldapConfiguration/authReassignRoles",
                      "/ldapConfiguration/roleAdminName",
                      "/ldapConfiguration/allAttributeName"),
                  UnitKind.IDP_DEPENDENT))
          .singleValue("/oidcConfiguration/customParams")
          .singleValue("/ldapConfiguration/trustStoreConfig")
          .firstSightDefault("/maxActiveSessionsPerUser")
          .firstSightDefault("/sessionExpiry")
          .firstSightDefault("/oidcConfiguration/tokenValidity")
          .firstSightDefault("/samlConfiguration/security/tokenValidity")
          .firstSightDefault("/ldapConfiguration/maxPoolSize")
          .build();

  private static final SettingsFieldPolicy AUTHORIZER =
      SettingsFieldPolicy.builder()
          // The authorizer and its request filter are instantiated once at startup.
          .deploymentOwned("/className")
          .deploymentOwned("/containerRequestFilter")
          // Domain restrictions only make sense together; half of them can lock everyone out.
          .group(
              new FieldGroup(
                  "domains",
                  List.of(
                      "/enforcePrincipalDomain",
                      "/principalDomain",
                      "/allowedDomains",
                      "/allowedEmailDomains"),
                  UnitKind.INDEPENDENT))
          .setMerge("/adminPrincipals")
          .setMerge("/adminEmails")
          .setMerge("/allowedEmailRegistrationDomains")
          .build();

  private static final Map<SettingsType, SettingsFieldPolicy> POLICIES =
      Map.of(AUTHENTICATION_CONFIGURATION, AUTHENTICATION, AUTHORIZER_CONFIGURATION, AUTHORIZER);

  private SettingsFieldPolicies() {}

  public static SettingsFieldPolicy of(SettingsType settingsType) {
    return POLICIES.getOrDefault(settingsType, SettingsFieldPolicy.independent());
  }
}
