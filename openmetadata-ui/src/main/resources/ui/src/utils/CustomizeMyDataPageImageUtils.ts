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
import ContextCenterImg from '../assets/img/widgets/landing/context-center.png';
import CuratedAssetsImg from '../assets/img/widgets/landing/curated-assets.png';
import DataEstateImg from '../assets/img/widgets/landing/data-estate.png';
import DataProductsImg from '../assets/img/widgets/landing/data-products.png';
import DataQualityImg from '../assets/img/widgets/landing/data-quality.png';
import DomainsImg from '../assets/img/widgets/landing/domains.png';
import KpisImg from '../assets/img/widgets/landing/kpis.png';
import PlatformHealthImg from '../assets/img/widgets/landing/platform-health.png';
import TeamActivityImg from '../assets/img/widgets/landing/team-activity.png';
import YoursAndFollowedImg from '../assets/img/widgets/landing/yours-and-followed.png';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';

// Widget preview screenshots are only needed inside customize/add-widget flows.
// Keeping them out of CustomizeMyDataPageClassBase avoids preloading these
// image modules when /my-data only needs layout defaults.
/**
 * One entry per landing-page widget, keyed by the key the picker looks up.
 *
 * The screenshots live under `widgets/landing/`, apart from the detail-page
 * previews beside it. Several keys outlived the widget they were named for —
 * `ACTIVITY_FEED` is the Team Activity card, not the old feed — so the files
 * are named for what they show, not for the key.
 *
 * A key with no entry still resolves to `''`, which WidgetCard renders as an
 * empty tile rather than a broken image.
 */
const WIDGET_IMAGE_BY_KEY: ReadonlyArray<[string, string]> = [
  [LandingPageWidgetKeys.PLATFORM_HEALTH, PlatformHealthImg],
  [LandingPageWidgetKeys.DATA_ESTATE, DataEstateImg],
  // Team Activity, despite the key — the card replaced the activity feed.
  [LandingPageWidgetKeys.ACTIVITY_FEED, TeamActivityImg],
  [LandingPageWidgetKeys.YOURS_AND_FOLLOWED, YoursAndFollowedImg],
  // Context Center, likewise: the landing card sits on the Knowledge Center key.
  [LandingPageWidgetKeys.KNOWLEDGE_CENTER, ContextCenterImg],
  [LandingPageWidgetKeys.CURATED_ASSETS, CuratedAssetsImg],
  [LandingPageWidgetKeys.DATA_QUALITY, DataQualityImg],
  [LandingPageWidgetKeys.DOMAINS, DomainsImg],
  [LandingPageWidgetKeys.DATA_PRODUCTS, DataProductsImg],
  [LandingPageWidgetKeys.KPI, KpisImg],
  // A detail-page key, not a landing one; kept for the callers that share this
  // table rather than because the landing picker can reach it.
  [DetailPageWidgetKeys.KNOWLEDGE_ARTICLE, KnowledgeCenterWidgetImg],
];

/**
 * The keys this table covers.
 *
 * Exported because the images themselves are not assertable: jest maps every
 * PNG import to `''`, so a test cannot tell "no entry" from "entry whose
 * module stubbed to empty". The keys are what a widget added without a preview
 * would actually be missing from.
 */
export const MY_DATA_WIDGET_IMAGE_KEYS: readonly string[] =
  WIDGET_IMAGE_BY_KEY.map(([widgetKey]) => widgetKey);

export const getMyDataWidgetImageFromKey = (widgetKey: string): string => {
  const match = WIDGET_IMAGE_BY_KEY.find(([key]) => key === widgetKey);

  return match ? match[1] : '';
};
