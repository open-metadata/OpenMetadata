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

package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import java.util.Collection;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * A new user's email domain is outside the domains the authorizer configuration allows to sign in
 * ({@code allowedEmailDomains}, or the deprecated {@code enforcePrincipalDomain} settings).
 */
public final class EmailDomainNotAllowedException extends WebServiceException {
  public EmailDomainNotAllowedException(String emailDomain, Collection<String> allowedDomains) {
    super(
        Response.Status.BAD_REQUEST,
        CatalogExceptionMessage.EMAIL_DOMAIN_NOT_ALLOWED,
        CatalogExceptionMessage.invalidEmailDomain(emailDomain, allowedDomains));
  }
}
