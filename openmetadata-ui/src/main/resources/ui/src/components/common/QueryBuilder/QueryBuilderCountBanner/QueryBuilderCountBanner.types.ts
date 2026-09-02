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
export interface QueryBuilderCountBannerProps {
  /** Matched asset count. The banner renders nothing while this is unknown. */
  count?: number | null;
  /** Render a placeholder instead of the banner while the count is in flight. */
  isLoading?: boolean;
  /**
   * Where the click-through goes. Without it the count is shown on its own
   * rather than as a link that leads nowhere.
   */
  exploreUrl?: string;
  /** i18n key for the link text, so each screen keeps its own wording. */
  linkLabelKey?: string;
  /** i18n key for the count sentence, so each screen keeps its own wording. */
  titleKey?: string;
  /** Anchor target for the link. */
  target?: string;
  className?: string;
  'data-testid'?: string;
}
