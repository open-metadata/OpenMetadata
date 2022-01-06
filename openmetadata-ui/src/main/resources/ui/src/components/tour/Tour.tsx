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

import ReactTutorial from '@deuex-solutions/react-tour';
import { observer } from 'mobx-react';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import AppState from '../../AppState';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { useTour } from '../../hooks/useTour';
import TourEndModal from '../Modals/TourEndModal/TourEndModal';

type Steps = {
  content?: string | React.ReactNode;
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
          Look up for matching data assets by &quot;name&quot;,
          &quot;description&quot;, &quot;column name&quot;, and so on from the{' '}
          <strong>search</strong> box.
        </p>
      ),
      position: [535, 70],
      selector: '#searchBox',
    },
    {
      content: () => (
        <p>
          In the search box, type <strong>&quot;{modifiedValue}&quot;</strong>.
          Hit <strong>Enter.</strong>
        </p>
      ),
      actionType: 'enter',
      userTypeText: modifiedValue,
      position: [535, 70],
      selector: '#searchBox',
      beforeNext: () => {
        AppState.currentTourPage = CurrentTourPageType.EXPLORE_PAGE;
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = CurrentTourPageType.MY_DATA_PAGE;
      },
      content: () => (
        <p>
          From the <strong>&quot;Explore&quot;</strong> page, get to know the
          details on the table entity, tier, usage, and database information
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
          Get to know the table <strong>schema.</strong> Add a description.
        </p>
      ),
      stepInteraction: false,
      position: [540, 65],
      arrowPosition: 'bottom',
      selector: '#schemaDetails',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 1;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 2;
      },
      actionType: 'click',
      content: () => (
        <p>
          Click on the <strong>&quot;Profiler&quot;</strong> tab.
        </p>
      ),
      position: [20, 240],
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
        AppState.activeTabforTourDatasetPage = 2;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      actionType: 'click',
      content: () => (
        <p>
          Click on the <strong>&quot;Lineage&quot;</strong> tab
        </p>
      ),
      position: [140, 240],
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
        AppState.activeTabforTourDatasetPage = 5;
      },
      actionType: 'click',
      content: () => (
        <p>
          Click on the <strong>&quot;Manage&quot;</strong> tab
        </p>
      ),
      position: [260, 240],
      selector: '#manage',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      content: () => (
        <p>
          From <strong>&quot;Manage&quot;</strong>, you can claim ownership, and
          set the tiers.
        </p>
      ),
      position: [560, 60],
      arrowPosition: 'bottom',
      stepInteraction: false,
      selector: '#manageTabDetails',
    },
  ];
};

const Tour = () => {
  const { isTourOpen, handleIsTourOpen } = useTour();
  const [steps] = useState<Steps[]>(getSteps(TOUR_SEARCH_TERM));
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
          stepWaitTimer={100}
          steps={steps}
          onRequestClose={() => handleIsTourOpen(false)}
        />
      ) : null}

      {showTourEndModal && <TourEndModal onSave={handleModalSubmit} />}
    </div>
  );
};

export default observer(Tour);
