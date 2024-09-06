/*
 *  Copyright 2022 Collate.
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

import i18next from 'i18next';
import React, { FC } from 'react';
import { EntityTabs } from '../enums/entity.enum';
import { CurrentTourPageType } from '../enums/tour.enum';
import { Transi18next } from './CommonUtils';

interface ArgObject {
  searchTerm: string;
  updateTourPage: (value: CurrentTourPageType) => void;
  updateActiveTab: (value: EntityTabs) => void;
  clearSearchTerm: () => void;
}

const ContentComponent: FC<{ key: string; text: string }> = ({
  key,
  text,
}: {
  key: string;
  text: string;
}) => (
  <p>
    <Transi18next
      i18nKey={key}
      renderElement={<strong />}
      values={{
        text,
      }}
    />
  </p>
);

export const getTourSteps = ({
  searchTerm,
  clearSearchTerm,
  updateActiveTab,
  updateTourPage,
}: ArgObject) => [
  {
    content: (
      <ContentComponent
        key="message.tour-step-activity-feed"
        text={i18next.t('label.activity-feed-plural')}
      />
    ),
    selector: '#feedData',
    stepInteraction: false,
  },
  {
    content: (
      <ContentComponent
        key="message.tour-step-search-for-matching-dataset"
        text={i18next.t('label.search')}
      />
    ),
    selector: '#searchBox',
    stepInteraction: false,
    beforeNext: clearSearchTerm,
  },
  {
    beforePrev: clearSearchTerm,
    content: (
      <ContentComponent
        key="message.tour-step-type-search-term"
        text={searchTerm}
      />
    ),
    actionType: 'enter',
    userTypeText: searchTerm,
    selector: '#searchBox',
    beforeNext: () => {
      clearSearchTerm();
      updateTourPage(CurrentTourPageType.EXPLORE_PAGE);
    },
  },
  {
    beforePrev: () => {
      updateTourPage(CurrentTourPageType.MY_DATA_PAGE);
    },
    content: (
      <ContentComponent
        key="message.tour-step-explore-summary-asset"
        text={i18next.t('label.explore')}
      />
    ),
    selector: '#tabledatacard0',
    stepInteraction: false,
  },
  {
    content: (
      <ContentComponent
        key="message.tour-step-click-on-link-to-view-more"
        text={i18next.t('label.schema')}
      />
    ),
    actionType: 'click',
    selector: '[data-testid="sample_data.ecommerce_db.shopify.dim_address"]',
    beforeNext: () => {
      updateTourPage(CurrentTourPageType.DATASET_PAGE);
    },
  },
  {
    beforePrev: () => {
      updateTourPage(CurrentTourPageType.EXPLORE_PAGE);
    },
    content: (
      <ContentComponent
        key="message.tour-high-level-assets-information-step"
        text={i18next.t('label.schema')}
      />
    ),
    stepInteraction: false,
    selector: '[data-testid="entity-page-header"]',
  },
  {
    content: (
      <ContentComponent
        key="message.tour-owner-step"
        text={i18next.t('label.schema')}
      />
    ),
    stepInteraction: false,
    selector: '[data-testid="owner-label"]',
  },
  {
    content: (
      <ContentComponent
        key="message.tour-follow-step"
        text={i18next.t('label.schema')}
      />
    ),
    stepInteraction: false,
    selector: '[data-testid="entity-follow-button"]',
  },
  {
    content: (
      <ContentComponent
        key="message.tour-step-get-to-know-table-schema"
        text={i18next.t('label.schema')}
      />
    ),
    stepInteraction: false,
    selector: '#schemaDetails',
  },
  {
    beforePrev: () => {
      updateActiveTab(EntityTabs.SCHEMA);
    },
    actionType: 'click',
    content: (
      <ContentComponent
        key="message.tour-step-click-on-entity-tab"
        text={i18next.t('label.sample-data')}
      />
    ),
    selector: `[data-testid="${EntityTabs.SAMPLE_DATA}"]`,
    beforeNext: () => {
      updateActiveTab(EntityTabs.SAMPLE_DATA);
    },
  },
  {
    content: (
      <ContentComponent
        key="message.tour-step-look-at-sample-data"
        text={i18next.t('label.sample-data')}
      />
    ),
    selector: '[data-testid="sample-data-table"]',
  },
  {
    beforePrev: () => {
      updateActiveTab(EntityTabs.SAMPLE_DATA);
    },
    beforeNext: () => {
      updateActiveTab(EntityTabs.PROFILER);
    },
    actionType: 'click',
    content: (
      <ContentComponent
        key="message.tour-step-click-on-entity-tab"
        text={i18next.t('label.profiler')}
      />
    ),
    selector: `[data-testid="${EntityTabs.PROFILER}"]`,
  },
  {
    content: (
      <ContentComponent
        key="message.tour-step-discover-data-assets-with-data-profile"
        text={i18next.t('label.data-entity', {
          entity: i18next.t('label.profiler'),
        })}
      />
    ),
    stepInteraction: false,
    selector: '#profilerDetails',
  },
  {
    beforePrev: () => {
      updateActiveTab(EntityTabs.PROFILER);
    },
    beforeNext: () => {
      updateActiveTab(EntityTabs.LINEAGE);
    },
    actionType: 'click',
    content: (
      <ContentComponent
        key="message.tour-step-click-on-entity-tab"
        text={i18next.t('label.lineage')}
      />
    ),
    selector: `[data-testid="${EntityTabs.LINEAGE}"]`,
  },
  {
    content: (
      <ContentComponent
        key="message.tour-step-trace-path-across-tables"
        text={i18next.t('label.lineage')}
      />
    ),
    stepInteraction: false,
    selector: `[data-testid="lineage-details"]`,
  },
];
