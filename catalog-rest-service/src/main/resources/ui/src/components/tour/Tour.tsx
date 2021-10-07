import { observer } from 'mobx-react';
import React from 'react';
import ReactTutorial from 'react-tutorial';
import { useTour } from '../../hooks/useTour';

const tuteSteps = [
  {
    content: 'Click on the next',
    actionType: 'click',
    position: 'bottom',
    selector: '#next',
  },
  {
    content: 'Click on the next',
    actionType: 'click',
    position: 'bottom',
    selector: '#next',
  },
  {
    content: 'Click on explore OpenMetadata',
    actionType: 'click',
    position: 'bottom',
    selector: '#take-tour',
  },
  {
    content: 'Click on explore',
    actionType: 'click',
    position: 'bottom',
    selector: '#explore',
  },
  {
    content: 'Type "dim" in search box',
    actionType: 'typing',
    userTypeText: 'dim',
    position: 'bottom',
    selector: '#searchBox',
  },
  {
    content: 'Click on the table',
    actionType: 'click',
    position: 'bottom',
    selector: '#bigquery.shopify.dim_address',
  },
  {
    content: 'Understand the schema',
    // actionType: 'click',
    position: 'button',
    selector: '#schemaTable',
  },
];

const Tour = () => {
  const { isTourOpen, handleIsTourOpen } = useTour();

  return (
    <div>
      {isTourOpen ? (
        <ReactTutorial
          showNumber
          playTour={isTourOpen}
          steps={tuteSteps}
          onRequestClose={() => handleIsTourOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default observer(Tour);
