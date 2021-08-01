import React from 'react';
import Stepper from '../../components/common/stepper';
import PageContainer from '../../components/containers/PageContainer';

const SQLBuilderPage = () => {
  return (
    <PageContainer>
      <Stepper
        showStepNumber
        steps={[{ name: 'step-1' }, { name: 'step-2' }, { name: 'step-3' }]}
      />
      <h1>SQL Builder</h1>
    </PageContainer>
  );
};

export default SQLBuilderPage;
