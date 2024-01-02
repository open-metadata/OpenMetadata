/*
 *  Copyright 2023 Collate.
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
import Table from './Table';

describe('Table component', () => {
  it('should display skeleton loader if loading is true', async () => {
    render(<Table loading />);

    expect(await screen.findByTestId('skeleton-table')).toBeInTheDocument();
  });

  it('should display skeleton loader if spinning is true', async () => {
    render(<Table loading={{ spinning: true }} />);

    expect(await screen.findByTestId('skeleton-table')).toBeInTheDocument();
  });

  it('should not display skeleton loader if loading is false', () => {
    render(<Table loading={false} />);

    expect(screen.queryByTestId('skeleton-table')).not.toBeInTheDocument();
  });

  it('should not display skeleton loader if spinning is false', () => {
    render(<Table loading={{ spinning: false }} />);

    expect(screen.queryByTestId('skeleton-table')).not.toBeInTheDocument();
  });

  it('should render column label while loading', async () => {
    render(<Table loading columns={[{ title: 'id' }, { title: 'name' }]} />);

    expect(await screen.findByText('id')).toBeInTheDocument();
    expect(await screen.findByText('name')).toBeInTheDocument();
  });
});
