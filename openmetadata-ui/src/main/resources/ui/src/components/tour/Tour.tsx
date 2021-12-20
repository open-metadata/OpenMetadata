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

import { observer } from 'mobx-react';
import React, { useState } from 'react';
import ReactTutorial from 'react-tutorial';
import AppState from '../../AppState';
import { useTour } from '../../hooks/useTour';

type Steps = {
  content?: string;
  actionType?: string;
  position?: string | number[];
  selector?: string;
  userTypeText?: string;
  waitTimer?: number;
};

const getSteps = (value: string) => {
  const modifiedValue = value.substr(0, 6);

  return [
    {
      content: `OpenMetadata is a Centralized Metadata Store. Discover all your data assets in a single place, collaborate with your co-workers.
         Understand your data assets and contribute to make it richer.`,
      position: [15, 345],
      selector: '#assetStatsCount',
    },
    {
      content: `Feed Data`,
      position: [640, 285],
      selector: '#feedData',
    },
    {
      content: `This is a search box where you can type "name", "description", "column name", etc. to find any matching data asset. For example, type "${modifiedValue}". Hit Enter.`,
      actionType: 'enter',
      position: [600, 85],
      selector: '#searchBox',
      beforeNext: () => {
        AppState.currentTourPage = 'explorePage';
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = 'myDataPage';
      },
      content: 'Click on the assets title for more details.',
      actionType: 'click',
      selector: '#tabledatacard0',
      position: [600, 320],
      beforeNext: () => {
        AppState.currentTourPage = 'datasetPage';
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = 'explorePage';
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 2;
      },
      content: 'Understand the schema of the table and add description.',
      position: [5, 255],
      selector: '#schema',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 1;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      content: 'Understand the profiler tab.',
      position: [75, 255],
      selector: '#profiler',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 2;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 5;
      },
      content: 'Understand lineage.',
      position: [200, 255],
      selector: '#lineage',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      content: 'You can claim ownership from here.',
      position: [300, 255],
      selector: '#manage',
    },
    {
      content: 'Click on explore to access all the assests.',
      actionType: 'click',
      position: [10, 70],
      selector: '#explore',
    },
  ];
};

const Tour = () => {
  const { isTourOpen, handleIsTourOpen } = useTour();
  const [steps] = useState<Steps[]>(getSteps('dim_a'));

  return (
    <div>
      {isTourOpen ? (
        <ReactTutorial
          disableKeyboardNavigation
          showNumber
          accentColor="#7147E8"
          inViewThreshold={200}
          maskColor="#302E36"
          playTour={isTourOpen}
          steps={steps}
          onRequestClose={() => handleIsTourOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default observer(Tour);
