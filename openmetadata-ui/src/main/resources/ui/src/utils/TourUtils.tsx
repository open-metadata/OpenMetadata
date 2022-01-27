/*
 *  Copyright 2021 Collate
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

import React from 'react';
import AppState from '../AppState';
import { CurrentTourPageType } from '../enums/tour.enum';

export const getSteps = (value: string, clearSearchTerm: () => void) => {
  return [
    {
      content: () => (
        <p>
          Discover all your data assets in a single place with{' '}
          <strong>OpenMetadata</strong>, a centralized metadata store.
          Collaborate with your team and get a holistic picture of the data in
          your organization.
        </p>
      ),
      position: [5, 360],
      stepInteraction: false,
      selector: '#assetStatsCount',
    },
    {
      content: () => (
        <p>
          <strong>Activity Feeds</strong> help you understand how the data is
          changing in your organization.
        </p>
      ),
      position: [540, 540],
      selector: '#feedData',
      stepInteraction: false,
    },
    {
      content: () => (
        <p>
          Search for matching data assets by &quot;name&quot;,
          &quot;description&quot;, &quot;column name&quot;, and so on from the{' '}
          <strong>Search</strong> box.
        </p>
      ),
      position: [535, 70],
      selector: '#searchBox',
      stepInteraction: false,
      beforeNext: clearSearchTerm,
    },
    {
      beforePrev: clearSearchTerm,
      content: () => (
        <p>
          In the search box, type <strong>&quot;{value}&quot;</strong>. Hit{' '}
          <strong>Enter.</strong>
        </p>
      ),
      actionType: 'enter',
      userTypeText: value,
      position: [535, 70],
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
          From the <strong>&quot;Explore&quot;</strong> page, view a summary of
          each asset, including: title, description, owner, tier (importance),
          usage, and location.
        </p>
      ),
      selector: '#tabledatacard0',
      stepInteraction: false,
      position: [550, 310],
    },
    {
      content: () => (
        <p>
          Click on the <strong>title of the asset</strong> to view more details.
        </p>
      ),
      actionType: 'click',
      selector: '#tabledatacard0Title',
      position: [210, 190],
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
          {' '}
          Get to know the table <strong>Schema</strong>, including column names
          and data types as well as column descriptions and tags. You can even
          view metadata for complex types such as structs.
        </p>
      ),
      stepInteraction: false,
      position: [540, 23],
      arrowPosition: 'bottom',
      selector: '#schemaDetails',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 1;
      },
      actionType: 'click',
      content: () => (
        <p>
          Click on the <strong>&quot;Sample Data&quot;</strong> tab.
        </p>
      ),
      position: [70, 240],
      selector: '#sampleData',
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 2;
      },
    },
    {
      arrowPosition: 'bottom',
      content: () => (
        <p>
          Take a look at the <strong>Sample Data</strong> to get a feel for what
          the table contains and how you might use it.
        </p>
      ),
      position: [530, 60],
      selector: '#sampleDataDetails',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 2;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      actionType: 'click',
      content: () => (
        <p>
          Click on the <strong>&quot;Profiler&quot;</strong> tab.
        </p>
      ),
      position: [200, 240],
      selector: '#profiler',
    },
    {
      content: () => (
        <p>
          Discover assets with the <strong>Data Profiler</strong>. Get to know
          the table usage stats, check for null values and duplicates, and
          understand the column data distributions.
        </p>
      ),
      arrowPosition: 'bottom',
      stepInteraction: false,
      position: [530, 20],
      selector: '#profilerDetails',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 4;
      },
      actionType: 'click',
      content: () => (
        <p>
          Click on the <strong>&quot;Lineage&quot;</strong> tab
        </p>
      ),
      position: [320, 240],
      selector: '#lineage',
    },
    {
      content: () => (
        <p>
          With <strong>Lineage</strong>, trace the path of data across tables,
          pipelines, & dashboards.
        </p>
      ),
      position: [530, 45],
      stepInteraction: false,
      arrowPosition: 'bottom',
      selector: '#lineageDetails',
    },
    {
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 6;
      },
      actionType: 'click',
      content: () => (
        <p>
          Click on the <strong>&quot;Manage&quot;</strong> tab
        </p>
      ),
      position: [440, 240],
      selector: '#manage',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 4;
      },
      content: () => (
        <p>
          From <strong>&quot;Manage&quot;</strong>, you can claim ownership, and
          set the tier.
        </p>
      ),
      position: [560, 60],
      arrowPosition: 'bottom',
      stepInteraction: false,
      selector: '#manageTabDetails',
    },
  ];
};
