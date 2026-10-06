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

import KnowledgeCenterWidgetImg from '../assets/img/widgets/context-center-widget.png';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';

// Widget preview screenshots are only needed inside customize/add-widget flows.
// Keeping them out of CustomizeMyDataPageClassBase avoids preloading these
// image modules when /my-data only needs layout defaults.
/**
 * Landing-page widgets deliberately have no entry here.
 *
 * Every screenshot this table used to carry was taken of a widget the topic
 * cards replaced — `activity-feed-widget.png` is the old feed, not the Team
 * Activity card now on `KnowledgePanel.ActivityFeed` — so the picker was
 * showing a confident picture of the wrong thing. A missing entry resolves to
 * `''`, which WidgetCard renders as an empty tile rather than a broken image,
 * and the card still carries its name and description. Add the replacement
 * screenshots here, one line each, when they land.
 */
const WIDGET_IMAGE_BY_KEY: ReadonlyArray<[string, string]> = [
  [DetailPageWidgetKeys.KNOWLEDGE_ARTICLE, KnowledgeCenterWidgetImg],
];

export const getMyDataWidgetImageFromKey = (widgetKey: string): string => {
  const match = WIDGET_IMAGE_BY_KEY.find(([key]) => key === widgetKey);

  return match ? match[1] : '';
};
