/*
 *  Copyright 2025 Collate.
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
import { Document } from '../../../../generated/entity/docStore/document';
import { AnnouncementEntity } from '../../../../rest/announcementsAPI';

export interface CustomiseLandingPageHeaderProps {
  addedWidgetsList?: string[];
  backgroundColor?: string;
  dataTestId?: string;
  handleAddWidget?: (
    newWidgetData: Document,
    placeholderWidgetKey: string,
    widgetSize: number
  ) => void;
  hideCustomiseButton?: boolean;
  isPreviewHeader?: boolean;
  onBackgroundColorUpdate?: (color: string) => Promise<void>;
  onHomePage?: boolean;
  overlappedContainer?: boolean;
  placeholderWidgetKey?: string;
  /**
   * When the parent already fetches global announcements (the landing page does, for the
   * sidebar widget), pass them through here so the header skips its own duplicate fetch.
   * Backwards-compatible: when omitted, the header keeps its own fetch for callers that
   * mount it standalone (e.g. the customize-page preview and the header-theme picker).
   */
  announcements?: AnnouncementEntity[];
  isAnnouncementLoading?: boolean;
}
