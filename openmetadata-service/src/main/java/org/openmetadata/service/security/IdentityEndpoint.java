/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.security;

import jakarta.ws.rs.NameBinding;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a resource method that creates, reveals, rotates or revokes a credential or session, so
 * that {@link ImpersonationRestrictionFilter} refuses it to impersonated requests.
 *
 * <p>The binding is resolved by Jersey against the method it actually dispatched to, so it holds
 * for every spelling of the URL that routes there (matrix parameters, trailing slashes, encoding).
 * ADR:2026-10-26-impersonated-requests-never-reach-credentials-or-grant-privileges
 */
@NameBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface IdentityEndpoint {}
