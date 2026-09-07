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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import okhttp3.HttpUrl;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SystemSettingsException;

/**
 * The OpenMetadata base URL prefixes every entity {@code href} the API hands out, and those hrefs
 * are parsed as absolute URLs by the ingestion framework. A scheme-less value such as {@code
 * example.org} yields {@code example.org/api/v1/...}, which only fails much later during ingestion
 * or a test connection (issue #26451). Reject it at the boundary.
 *
 * <p>Parsing goes through okhttp's {@link HttpUrl} — the same type {@code
 * DefaultOperationalConfigProvider} uses to build the default value. It accepts only absolute
 * http/https URLs, and unlike {@link java.net.URI} it follows WHATWG host rules, so an internal
 * hostname containing an underscore stays valid. That is also the standard the browser's {@code new
 * URL()} implements, so the UI form and this check agree on what is valid.
 *
 * <p>This deliberately does not delegate to {@link URLValidator}: that guards <em>outbound</em>
 * fetches against SSRF and so rejects loopback and private-range hosts, which are valid
 * OpenMetadata base URLs (the shipped default is {@code http://localhost:8585}, and Kubernetes
 * deployments commonly use a cluster IP).
 */
public final class OpenMetadataBaseUrlValidator {
  private static final String INVALID_URL_MESSAGE =
      "OpenMetadata URL '%s' must be an absolute http or https URL including the host, for example https://example.org";

  private OpenMetadataBaseUrlValidator() {}

  /** No-op for every setting other than the OpenMetadata base URL configuration. */
  public static void validate(Settings setting) {
    boolean isBaseUrlSetting =
        setting != null
            && setting.getConfigType() == SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION;
    if (isBaseUrlSetting) {
      validateUrl(
          JsonUtils.convertValue(setting.getConfigValue(), OpenMetadataBaseUrlConfiguration.class)
              .getOpenMetadataUrl());
    }
  }

  public static void validateUrl(String openMetadataUrl) {
    if (nullOrEmpty(openMetadataUrl)) {
      throw new SystemSettingsException("OpenMetadata URL must not be empty");
    }

    if (HttpUrl.parse(openMetadataUrl) == null) {
      throw new SystemSettingsException(String.format(INVALID_URL_MESSAGE, openMetadataUrl));
    }
  }
}
