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
import { observer } from 'mobx-react';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTourProvider } from '../../components/TourProvider/TourProvider';
import { PRIMERY_COLOR } from '../../constants/constants';
import { CurrentTourPageType } from '../../enums/tour.enum';
import TourEndModal from '../Modals/TourEndModal/TourEndModal';
import './tour.style.less';

const Tour = ({ steps }: { steps: TourSteps[] }) => {
  const { isTourOpen, updateIsTourOpen, updateTourPage } = useTourProvider();
  const [showTourEndModal, setShowTourEndModal] = useState(false);
  const history = useHistory();

  const handleModalSubmit = () => {
    updateTourPage(CurrentTourPageType.MY_DATA_PAGE);
    history.push('/');
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
          accentColor={PRIMERY_COLOR}
          inViewThreshold={200}
          lastStepNextButton={
            <Button onClick={() => setShowTourEndModal(true)}>
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
            </Button>
          }
          maskColor="#302E36"
          playTour={isTourOpen}
          stepWaitTimer={300}
          steps={steps}
          onRequestClose={handleRequestClose}
          onRequestSkip={handleModalSubmit}
        />
      ) : null}

      <TourEndModal visible={showTourEndModal} onSave={handleModalSubmit} />
    </div>
  );
};

export default observer(Tour);
