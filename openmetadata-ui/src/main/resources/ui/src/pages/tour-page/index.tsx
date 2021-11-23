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
