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
