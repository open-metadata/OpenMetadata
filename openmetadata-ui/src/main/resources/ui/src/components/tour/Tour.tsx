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
      position: [600, 235],
      selector: '#statesHeader',
    },
    {
      content: `This is a search box where you can type "name", "description", "column name", etc. to find any matching data asset. For example, type "${modifiedValue}". Hit Enter.`,
      actionType: 'enter',
      position: 'bottom',
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
      // position: 'bottom',
      selector: '#tabledatacard0',
      position: [700, 240],
      beforeNext: () => {
        AppState.currentTourPage = 'datasetPage';
      },
    },
    {
      beforePrev: () => {
        AppState.currentTourPage = 'explorePage';
      },
      content: 'Understand the schema of the table and add description.',
      position: 'bottom',
      selector: '#schema',
    },
    {
      content: 'Click here to Understand the profiler tab.',
      position: 'bottom',
      selector: '#profiler',
    },
    {
      content: 'Click here to understand lineage.',
      position: 'bottom',
      selector: '#lineage',
    },
    {
      content: 'Click here to claim ownership.',
      position: 'bottom',
      selector: '#manage',
    },
    {
      content: 'Click on explore to access all the assests.',
      actionType: 'click',
      position: 'bottom',
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
