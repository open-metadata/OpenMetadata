/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import GlossaryTermRouter from './GlossaryTermRouter';

jest.mock('../../Glossary/GlossaryVersion/GlossaryVersion.component', () => {
  return jest.fn(() => <div>GlossaryTermVersion</div>);
});

describe('GlossaryRouter', () => {
  it('should render GlossaryVersion component for glossary terms version route', async () => {
    render(
      <MemoryRouter
        initialEntries={['/terms/versions/123/tab', '/terms/versions/123']}>
        <GlossaryTermRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('GlossaryTermVersion')).toBeInTheDocument();
  });
});
