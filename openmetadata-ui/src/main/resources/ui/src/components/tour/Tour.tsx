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
      position: [600, 233],
      selector: '#statesHeader',
    },
    {
      content: `This is a search box where you can type "name", "description", "column name", etc. to find any matching data asset. For example, type "${modifiedValue}". Hit Enter.`,
      actionType: 'enter',
      position: [25, 78],
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
      position: [700, 270],
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
      position: [5, 230],
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
      position: [75, 230],
      selector: '#profiler',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 2;
      },
      beforeNext: () => {
        AppState.activeTabforTourDatasetPage = 4;
      },
      content: 'Understand lineage.',
      position: [200, 230],
      selector: '#lineage',
    },
    {
      beforePrev: () => {
        AppState.activeTabforTourDatasetPage = 3;
      },
      content: 'You can claim ownership from here.',
      position: [300, 230],
      selector: '#manage',
    },
    {
      content: 'Click on explore to access all the assests.',
      actionType: 'click',
      position: [220, 70],
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
