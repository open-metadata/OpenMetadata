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

import { BadgeColors } from '@openmetadata/ui-core-components';
import { IconProps } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';

/**
 * Stable ids for the cards in "Topics to catch up on". They key the per-card
 * collapse state, so they outlive any reordering of the grid.
 */
export enum TopicKey {
  PLATFORM_HEALTH = 'platformHealth',
  DATA_ESTATE = 'dataEstate',
  TEAM_ACTIVITY = 'teamActivity',
  YOURS_AND_FOLLOWED = 'yoursAndFollowed',
  CONTEXT_CENTER = 'contextCenter',
  CURATED_ASSETS = 'curatedAssets',
  DATA_QUALITY = 'dataQuality',
  DOMAINS = 'domains',
  DATA_PRODUCTS = 'dataProducts',
  KPIS = 'kpis',
}

/** Headline status chip on a card header — absent when there is nothing to flag. */
export interface TopicStatus {
  label: string;
  color: BadgeColors;
}

/** The link in a card's footer, e.g. "Open Ingestion". */
export interface TopicAction {
  label: string;
  onPress: () => void;
}

/**
 * What a card says when there is nothing in it yet — no services, no tests, no
 * domains. It replaces the card's summary, status and footer, all of which
 * would otherwise restate a row of zeros.
 */
export interface TopicEmptyStateConfig {
  icon: FC<IconProps>;
  title: string;
  description: string;
  /** Header line while empty: what the card is for, there being nothing to summarise. */
  summary?: string;
  /**
   * The card stays empty until someone configures something — a connector, a
   * test, a KPI — rather than until activity happens, and says so in the header.
   */
  needsSetup?: boolean;
  /** Absent when the viewer may not create what the card is waiting for. */
  action?: TopicAction;
}

export interface TopicIconTone {
  icon: FC<IconProps>;
  /** Tinted tile behind the icon — surface plus its matching foreground. */
  tile: string;
}

/** One size for every icon-button affordance in a topic card's header. */
export const TOGGLE_ICON_CLASS = 'tw:*:data-icon:size-3.5';
