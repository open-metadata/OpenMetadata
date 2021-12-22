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
import ReactTutorial from '@deuex-solutions/react-tutorial';
import AppState from '../../AppState';
import { useTour } from '../../hooks/useTour';
import TourEndModal from '../Modals/TourEndModal/TourEndModal';
import { useHistory } from 'react-router-dom';
import { CurrentTourPageType } from '../../enums/tour.enum';

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
      userTypeText: modifiedValue,
      position: [600, 85],
      selector: '#searchBox',
      beforeNext: () => {
        AppState.currentTourPage = CurrentTourPageType.EXPLORE_PAGE;
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = CurrentTourPageType.MY_DATA_PAGE;
      },
      content: 'Click on the assets title for more details.',
      actionType: 'click',
      selector: '#tabledatacard0',
      position: [600, 320],
      beforeNext: () => {
        AppState.currentTourPage = CurrentTourPageType.DATASET_PAGE;
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = CurrentTourPageType.EXPLORE_PAGE;
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
        AppState.activeTabforTourDatasetPage = 2;
      },
      actionType: 'click',
      content: 'Click on the profiler tab.',
      position: [75, 255],
      selector: '#profiler',
    },
    {
      content: 'Understand the profiler tab.',
      position: [75, 255],
      selector: '#profiler',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 2;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      actionType: 'click',
      content: 'Click lineage.',
      position: [200, 255],
      selector: '#lineage',
    },
    {
      content: 'Understand lineage.',
      position: [200, 255],
      selector: '#lineage',
    },
    {
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 5;
      },
      actionType: 'click',
      content: 'Click on manage tab',
      position: [300, 255],
      selector: '#manage',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      content: 'You can claim ownership from here.',
      position: [300, 255],
      selector: '#manage',
    },
  ];
};

const Tour = () => {
  const { isTourOpen, handleIsTourOpen } = useTour();
  const [steps] = useState<Steps[]>(getSteps('dim_a'));
  const [showTourEndModal, setShowTourEndModal] = useState(false);
  const history = useHistory();

  const handleModalSubmit = () => {
    history.push('/');
  };

  return (
    <div>
      {isTourOpen ? (
        <ReactTutorial
          disableDotsNavigation
          disableKeyboardNavigation
          showNumber
          accentColor="#7147E8"
          inViewThreshold={200}
          lastStepNextButton={
            <button
              className="tw-w-4"
              onClick={() => setShowTourEndModal(true)}>
              <svg viewBox="0 0 18.4 14.4">
                <path
                  d="M17 7.2H1M10.8 1 17 7.2l-6.2 6.2"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeMiterlimit={10}
                  strokeWidth={2}
                />
              </svg>
            </button>
          }
          maskColor="#302E36"
          playTour={isTourOpen}
          steps={steps}
          onRequestClose={() => handleIsTourOpen(false)}
        />
      ) : null}

      {showTourEndModal && <TourEndModal onSave={handleModalSubmit} />}
    </div>
  );
};

export default observer(Tour);
