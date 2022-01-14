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
import { TourSteps } from 'Models';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTour } from '../../hooks/useTour';
import TourEndModal from '../Modals/TourEndModal/TourEndModal';

const Tour = ({ steps }: { steps: TourSteps[] }) => {
  const { isTourOpen, handleIsTourOpen } = useTour();
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
          showCloseButton
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
          stepWaitTimer={300}
          steps={steps}
          onRequestClose={() => handleIsTourOpen(false)}
          onRequestSkip={handleModalSubmit}
        />
      ) : null}

      {showTourEndModal && <TourEndModal onSave={handleModalSubmit} />}
    </div>
  );
};

export default observer(Tour);
