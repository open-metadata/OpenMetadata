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
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * A write tried to change fields of a setting that the deployment configuration owns, because the
 * setting's source is ENV. They would be overwritten again on the next start.
 */
public class SettingsManagedByEnvironmentException extends WebServiceException {
  private static final String ERROR_TYPE = "SETTINGS_MANAGED_BY_ENVIRONMENT";

  public SettingsManagedByEnvironmentException(
      SettingsType settingsType, String modeVariable, Collection<String> paths) {
    super(
        Response.Status.CONFLICT,
        ERROR_TYPE,
        String.format(
            "%s is managed by the deployment configuration (%s=ENV), so %s cannot be changed "
                + "here. Change the configuration file or environment and restart the server.",
            settingsType.value(), modeVariable, String.join(", ", paths)));
  }
}
