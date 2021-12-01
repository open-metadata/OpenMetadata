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
      actionType: 'wait',
      position: [775, 240],
      waitTimer: 8000,
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
      position: 'bottom',
      selector: '#tabledatacard0',
    },
    {
      content: 'Understand the schema of the table and add description.',
      position: 'bottom',
      selector: '#schema',
      actionType: 'wait',
      waitTimer: 8000,
    },
    {
      content: 'Click on profiler.',
      position: 'bottom',
      selector: '#profiler',
      actionType: 'click',
    },
    {
      content: 'Understand the profiler tab.',
      position: 'bottom',
      selector: '#profiler',
      actionType: 'wait',
      waitTimer: 8000,
    },
    {
      content: 'Click on lineage tab.',
      position: 'bottom',
      selector: '#lineage',
      actionType: 'click',
    },
    {
      content: 'understand lineage.',
      position: 'bottom',
      selector: '#lineage',
      actionType: 'wait',
      waitTimer: 8000,
    },
    {
      content: 'Click on manage tab.',
      position: 'bottom',
      selector: '#manage',
      actionType: 'click',
    },
    {
      content: 'claim ownership.',
      position: 'bottom',
      selector: '#manage',
      actionType: 'wait',
      waitTimer: 8000,
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
