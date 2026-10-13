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
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../enums/CustomizeDetailPage.enum';
import { CommonWidgetComponent } from './CommonWidgets.types';
import { WidgetKey } from './CommonWidgets.utils';
import { CertificationWidget } from './widgets/CertificationWidget';
import { CustomPropertiesWidget } from './widgets/CustomPropertiesWidget';
import { DataProductsWidget } from './widgets/DataProductsWidget';
import { DescriptionWidget } from './widgets/DescriptionWidget';
import { DomainWidget } from './widgets/DomainWidget';
import { ExpertsWidget } from './widgets/ExpertsWidget';
import { GlossaryWidget } from './widgets/GlossaryWidget';
import { LeftPanelWidget } from './widgets/LeftPanelWidget';
import { OwnerWidget } from './widgets/OwnerWidget';
import { ReviewerWidget } from './widgets/ReviewerWidget';
import { TagsWidget } from './widgets/TagsWidget';
import { TierWidget } from './widgets/TierWidget';

/**
 * Registry of common-widget renderers, keyed by their layout widget id.
 *
 * Each entry is a self-contained component that owns its own hooks, memos,
 * state and closures — so nothing initialises for a widget key that isn't the
 * one being rendered. The dispatcher in CommonWidgets.tsx exact-matches the
 * incoming widgetConfig.i (with a `-<n>` duplicate-instance suffix allowed)
 * against these keys; anything not present falls through to
 * commonWidgetClassBase.getCommonWidgetsFromConfig.
 *
 * Typed as `Record<string, ...>` — not `Record<WidgetKey, ...>` — because
 * DetailPageWidgetKeys and GlossaryTermDetailPageWidgetKeys share several
 * string values (e.g. both TABS = 'KnowledgePanel.Tabs') and TS refuses index
 * access on a Record whose union key contains those collisions. `addWidget`
 * keeps insertion sites WidgetKey-checked.
 */
const registry: Partial<Record<string, CommonWidgetComponent>> = {};

const addWidget = (key: WidgetKey, component: CommonWidgetComponent): void => {
  registry[key] = component;
};

addWidget(DetailPageWidgetKeys.DESCRIPTION, DescriptionWidget);
addWidget(DetailPageWidgetKeys.DATA_PRODUCTS, DataProductsWidget);
addWidget(DetailPageWidgetKeys.TAGS, TagsWidget);
addWidget(DetailPageWidgetKeys.GLOSSARY_TERMS, GlossaryWidget);
addWidget(DetailPageWidgetKeys.CUSTOM_PROPERTIES, CustomPropertiesWidget);
addWidget(DetailPageWidgetKeys.OWNERS, OwnerWidget);
addWidget(DetailPageWidgetKeys.EXPERTS, ExpertsWidget);
addWidget(DetailPageWidgetKeys.DOMAIN, DomainWidget);
addWidget(DetailPageWidgetKeys.TIER, TierWidget);
addWidget(DetailPageWidgetKeys.CERTIFICATION, CertificationWidget);
addWidget(DetailPageWidgetKeys.LEFT_PANEL, LeftPanelWidget);
addWidget(GlossaryTermDetailPageWidgetKeys.REVIEWER, ReviewerWidget);

export const COMMON_WIDGET_REGISTRY: Readonly<
  Partial<Record<string, CommonWidgetComponent>>
> = registry;

export const REGISTERED_WIDGET_KEYS = Object.keys(
  COMMON_WIDGET_REGISTRY
) as WidgetKey[];
