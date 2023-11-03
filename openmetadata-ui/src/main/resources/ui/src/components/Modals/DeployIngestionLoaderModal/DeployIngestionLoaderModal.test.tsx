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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import DeployIngestionLoaderModal from './DeployIngestionLoaderModal';
import { DeployIngestionLoaderModalProps } from './DeployIngestionLoaderModal.interface';

const deployIngestionLoaderModalProps = {
  ingestionName: 'test_metadata',
  action: 'Creating',
  progress: 0,
  isIngestionCreated: false,
  isDeployed: false,
  visible: true,
} as DeployIngestionLoaderModalProps;

describe('Test DeployIngestionLoaderModal component', () => {
  it('Component should render properly', async () => {
    render(
      <DeployIngestionLoaderModal {...deployIngestionLoaderModalProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const deployModal = await screen.findByTestId('deploy-modal');

    expect(deployModal).toBeInTheDocument();
  });

  it('Component should render properly if deploy and ingestion is true', async () => {
    render(
      <DeployIngestionLoaderModal
        {...deployIngestionLoaderModalProps}
        isDeployed
        isIngestionCreated
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const deployModal = await screen.findByTestId('deploy-modal');

    expect(deployModal).toBeInTheDocument();
  });
});
