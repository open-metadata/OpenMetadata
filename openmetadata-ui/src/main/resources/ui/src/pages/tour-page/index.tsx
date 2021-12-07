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

import React, { useEffect, useState } from 'react';
import { FirstTimeUserModal } from '../../components/Modals/FirstTimeUserModal/FirstTimeUserModal';
import { useTour } from '../../hooks/useTour';
// import MyDataPage from '../../components/LandingPage/MyData.component';

const TourPage = () => {
  const [showFirstTimeUserModal, setShowFirstTimeUserModal] = useState(true);
  const { handleIsTourOpen } = useTour();

  useEffect(() => {
    handleIsTourOpen(true);
  }, []);

  const handleFirstTimeUser = () => {
    setShowFirstTimeUserModal(false);
  };

  return (
    <div>
      {/* <MyDataPage /> */}
      {showFirstTimeUserModal && (
        <FirstTimeUserModal
          onCancel={() => setShowFirstTimeUserModal(true)}
          onSave={handleFirstTimeUser}
        />
      )}
    </div>
  );
};

export default TourPage;
