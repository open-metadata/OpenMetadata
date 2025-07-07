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
import { EntityTabs } from '../enums/entity.enum';
import { CurrentTourPageType } from '../enums/tour.enum';
import { Transi18next } from './CommonUtils';

interface ArgObject {
  searchTerm: string;
  updateTourPage: (value: CurrentTourPageType) => void;
  updateActiveTab: (value: EntityTabs) => void;
  clearSearchTerm: () => void;
}

export const getTourSteps = ({
  searchTerm,
  clearSearchTerm,
  updateActiveTab,
  updateTourPage,
}: ArgObject) => [
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-activity-feed"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.activity-feed-plural'),
          }}
        />
      </p>
    ),
    selector: '#feedData',
    stepInteraction: false,
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-search-for-matching-dataset"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.search'),
          }}
        />
      </p>
    ),
    selector: '#searchBox',
    stepInteraction: false,
    beforeNext: clearSearchTerm,
  },
  {
    beforePrev: clearSearchTerm,
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-type-search-term"
          renderElement={<strong />}
          values={{
            text: searchTerm,
            enterText: i18next.t('label.enter'),
          }}
        />
      </p>
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
      <p>
        <Transi18next
          i18nKey="message.tour-step-explore-summary-asset"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.explore'),
          }}
        />
      </p>
    ),
    selector: '#tabledatacard0',
    stepInteraction: false,
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-click-on-link-to-view-more"
          renderElement={<strong />}
        />
      </p>
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
      <p>
        <Transi18next
          i18nKey="message.tour-high-level-assets-information-step"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.schema'),
          }}
        />
      </p>
    ),
    stepInteraction: false,
    selector: '[data-testid="entity-page-header"]',
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-owner-step"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.schema'),
          }}
        />
      </p>
    ),
    stepInteraction: false,
    selector: '[data-testid="owner-label"]',
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-follow-step"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.schema'),
          }}
        />
      </p>
    ),
    stepInteraction: false,
    selector: '[data-testid="entity-follow-button"]',
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-get-to-know-table-schema"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.schema'),
          }}
        />
      </p>
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
      <p>
        <Transi18next
          i18nKey="message.tour-step-click-on-entity-tab"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.sample-data'),
          }}
        />
      </p>
    ),
    selector: `[data-testid="${EntityTabs.SAMPLE_DATA}"]`,
    beforeNext: () => {
      updateActiveTab(EntityTabs.SAMPLE_DATA);
    },
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-look-at-sample-data"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.sample-data'),
          }}
        />
      </p>
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
      <p>
        <Transi18next
          i18nKey="message.tour-step-click-on-entity-tab"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.data-observability'),
          }}
        />
      </p>
    ),
    selector: `[data-testid="${EntityTabs.PROFILER}"]`,
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-discover-data-assets-with-data-profile"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.data-entity', {
              entity: i18next.t('label.profiler'),
            }),
          }}
        />
      </p>
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
      <p>
        <Transi18next
          i18nKey="message.tour-step-click-on-entity-tab"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.lineage'),
          }}
        />
      </p>
    ),
    selector: `[data-testid="${EntityTabs.LINEAGE}"]`,
  },
  {
    content: (
      <p>
        <Transi18next
          i18nKey="message.tour-step-trace-path-across-tables"
          renderElement={<strong />}
          values={{
            text: i18next.t('label.lineage'),
          }}
        />
      </p>
    ),
    stepInteraction: false,
    selector: `[data-testid="lineage-details"]`,
  },
];
