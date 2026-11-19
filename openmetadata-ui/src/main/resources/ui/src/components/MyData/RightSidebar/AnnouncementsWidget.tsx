/*
 *  Copyright 2023 Collate.
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

/**
 * Compatibility forward for openmetadata-collate, whose
 * `overrides/CustomizeMyDataPageClassCollate.ts` imports
 * `AnnouncementsWidgetProps` from this path via the generated mirror. The
 * widget component itself had no consumer in this repo and was removed;
 * delete this file once Collate stops importing the type.
 */
import { AnnouncementEntity } from '../../../rest/announcementsAPI';

// Deliberately does not extend WidgetCommonProps (a pages-layer type): the only
// consumer intersects this with WidgetCommonProps itself, so the result is the
// same and this file stays off the pages layer.
export interface AnnouncementsWidgetProps {
  isAnnouncementLoading?: boolean;
  announcements?: AnnouncementEntity[];
}
