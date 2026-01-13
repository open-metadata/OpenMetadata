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

import ReactTutorial, { TourSteps } from '@deuex-solutions/react-tour';
import { Button } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import TourEndModal from '../Modals/TourEndModal/TourEndModal';
import './tour.style.less';

const Tour = ({ steps }: { steps: TourSteps[] }) => {
  const { isTourOpen, updateIsTourOpen, updateTourPage } = useTourProvider();
  const { theme } = useApplicationStore();
  const [showTourEndModal, setShowTourEndModal] = useState(false);
  const navigate = useNavigate();

  const handleModalSubmit = () => {
    updateTourPage(CurrentTourPageType.MY_DATA_PAGE);
    navigate('/');
  };

  const handleRequestClose = () => {
    updateIsTourOpen(false);
  };

  return (
    <div className="tour-container">
      {isTourOpen ? (
        <ReactTutorial
          disableDotsNavigation
          disableKeyboardNavigation
          showCloseButton
          showNumber
          accentColor={theme.primaryColor ?? ''}
          inViewThreshold={200}
          lastStepNextButton={
            <Button
              data-testid="last-step-button"
              icon={
                <svg viewBox="0 0 18.4 14.4" width={16}>
                  <path
                    d="M17 7.2H1M10.8 1 17 7.2l-6.2 6.2"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeMiterlimit={10}
                    strokeWidth={2}
                  />
                </svg>
              }
              type="text"
              onClick={() => setShowTourEndModal(true)}
            />
          }
          maskColor="#302E36"
          playTour={isTourOpen}
          stepWaitTimer={900}
          steps={steps}
          onRequestClose={handleRequestClose}
          onRequestSkip={handleModalSubmit}
        />
      ) : null}

      <TourEndModal visible={showTourEndModal} onSave={handleModalSubmit} />
    </div>
  );
};

export default Tour;
