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
import React from 'react';
import AppState from '../AppState';
import { CurrentTourPageType } from '../enums/tour.enum';
import { Transi18next } from './CommonUtils';
import { getCurrentDatasetTab } from './DatasetDetailsUtils';

export const getSteps = (value: string, clearSearchTerm: () => void) => {
  return [
    {
      content: () => (
        <p>
          <Transi18next
            i18nKey="message.tour-step-discover-all-assets-at-one-place"
            renderElement={<strong />}
            values={{
              text: i18next.t('label.open-metadata'),
            }}
          />
        </p>
      ),
      stepInteraction: false,
      selector: '#assetStatsCount',
    },
    {
      content: () => (
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
      content: () => (
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
      content: () => (
        <p>
          <Transi18next
            i18nKey="message.tour-step-type-search-term"
            renderElement={<strong />}
            values={{
              text: value,
              enterText: i18next.t('label.enter'),
            }}
          />
        </p>
      ),
      actionType: 'enter',
      userTypeText: value,
      selector: '#searchBox',
      beforeNext: () => {
        clearSearchTerm();
        AppState.currentTourPage = CurrentTourPageType.EXPLORE_PAGE;
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = CurrentTourPageType.MY_DATA_PAGE;
      },
      content: () => (
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
      content: () => (
        <p>
          <Transi18next
            i18nKey="message.tour-step-click-on-link-to-view-more"
            renderElement={<strong />}
          />
        </p>
      ),
      actionType: 'click',
      selector: '#tabledatacard0-title',
      beforeNext: () => {
        AppState.currentTourPage = CurrentTourPageType.DATASET_PAGE;
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = CurrentTourPageType.EXPLORE_PAGE;
      },
      content: () => (
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
        AppState.activeTabforTourDatasetPage = getCurrentDatasetTab('schema');
      },
      actionType: 'click',
      content: () => (
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
      selector: '#sampleData',
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage =
          getCurrentDatasetTab('sample_data');
      },
    },
    {
      content: () => (
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
      selector: '#sampleDataDetails',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage =
          getCurrentDatasetTab('sample_data');
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = getCurrentDatasetTab('profiler');
      },
      actionType: 'click',
      content: () => (
        <p>
          <Transi18next
            i18nKey="message.tour-step-click-on-entity-tab"
            renderElement={<strong />}
            values={{
              text: i18next.t('label.profiler'),
            }}
          />
        </p>
      ),
      selector: '#profilerDataQuality',
    },
    {
      content: () => (
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
        AppState.activeTabforTourDatasetPage = getCurrentDatasetTab('profiler');
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = getCurrentDatasetTab('lineage');
      },
      actionType: 'click',
      content: () => (
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
      selector: '#lineage',
    },
    {
      content: () => (
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
      selector: '#lineageDetails',
    },
  ];
};
