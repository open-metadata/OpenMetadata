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
 * SPI interface for branding values used in chat alert notifications.
 * Commercial distributions override this to supply their own product name and logo URL
 * without forking the decorator classes.
 *
 * Register implementations via META-INF/services/org.openmetadata.service.util.branding.MessageBrandingProvider.
 * The highest-priority provider wins (see MessageBrandingResolver).
 */
public interface MessageBrandingProvider {

  /** Display name of the product, e.g. "OpenMetadata" or "Collate". */
  String getProductName();

  /** Stable CDN URL for the square logo used as a thumbnail in chat messages. */
  String getLogoUrl();

  /** Priority used to select among multiple providers. Higher value wins. */
  int getPriority();
}
