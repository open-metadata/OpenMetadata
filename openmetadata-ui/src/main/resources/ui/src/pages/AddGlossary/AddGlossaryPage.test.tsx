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

import { findByText, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddGlossaryPage from './AddGlossaryPage.component';

jest.mock('../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../components/Glossary/AddGlossary/AddGlossary.component', () => {
  return jest.fn().mockReturnValue(<div>AddGlossary.component</div>);
});

jest.mock('../../rest/glossaryAPI', () => ({
  addGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

const mockProps = {
  pageTitle: 'add-glossary',
};

describe('Test AddGlossary component page', () => {
  it('AddGlossary component page should render', async () => {
    const { container } = render(<AddGlossaryPage {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const addGlossary = await findByText(container, /AddGlossary.component/i);

    expect(addGlossary).toBeInTheDocument();
  });
});
