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
import { createContext, useContext } from 'react';

export interface TopicCollapseValue {
  /**
   * Whether this surface offers collapsing at all.
   *
   * False without a provider, which is what keeps the chevron off the persona
   * editor: there the card already carries a drag handle and a remove button,
   * and collapsing a card you are arranging only hides what you came to see.
   */
  isEnabled: boolean;
  isCollapsed: (widgetKey: string) => boolean;
  toggle: (widgetKey: string) => void;
}

const DEFAULT_VALUE: TopicCollapseValue = {
  isCollapsed: () => false,
  isEnabled: false,
  toggle: () => undefined,
};

/**
 * Per-card collapse state, held by the page and read by the card.
 *
 * A context rather than props because the cards sit behind the widget registry:
 * the page renders keys, not components, so threading a prop would mean adding
 * it to `WidgetCommonProps` and forwarding it through all ten widgets purely to
 * reach the shell they share.
 *
 * Keyed by the grid instance key (`KnowledgePanel.X-42`) rather than the topic,
 * so the page can map a collapsed card straight onto the layout entry whose
 * height it has to shrink.
 */
export const TopicCollapseContext =
  createContext<TopicCollapseValue>(DEFAULT_VALUE);

export const useTopicCollapse = (): TopicCollapseValue =>
  useContext(TopicCollapseContext);
