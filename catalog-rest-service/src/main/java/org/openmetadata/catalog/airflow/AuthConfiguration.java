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

package org.openmetadata.catalog.airflow;

import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.security.client.Auth0SSOClientConfig;
import org.openmetadata.catalog.security.client.AzureSSOClientConfig;
import org.openmetadata.catalog.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import org.openmetadata.catalog.security.client.OktaSSOClientConfig;
import org.openmetadata.catalog.security.client.OpenMetadataJWTClientConfig;

public class AuthConfiguration {

  @Getter @Setter private GoogleSSOClientConfig google;

  @Getter @Setter private OktaSSOClientConfig okta;

  @Getter @Setter private Auth0SSOClientConfig auth0;

  @Getter @Setter private AzureSSOClientConfig azure;

  @Getter @Setter private CustomOIDCSSOClientConfig customOidc;

  @Getter @Setter private OpenMetadataJWTClientConfig openmetadata;
}
