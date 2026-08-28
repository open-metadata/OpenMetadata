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

package org.openmetadata.service.util.branding;

/**
 * Default MessageBrandingProvider returning OpenMetadata branding values.
 * Commercial distributions override this by registering a higher-priority provider
 * via META-INF/services.
 */
public class DefaultMessageBrandingProvider implements MessageBrandingProvider {

  @Override
  public String getProductName() {
    return "OpenMetadata";
  }

  @Override
  public String getLogoUrl() {
    return "https://cdn.getcollate.io/omd_logo192.png";
  }

  @Override
  public int getPriority() {
    return 0;
  }
}
