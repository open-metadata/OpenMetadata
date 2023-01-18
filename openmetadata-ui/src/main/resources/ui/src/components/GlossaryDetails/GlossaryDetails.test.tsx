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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { mockedGlossaries } from '../../mocks/Glossary.mock';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import GlossaryDetails from './GlossaryDetails.component';

jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockReturnValue(<>Tags-container component</>);
});

jest.mock('components/common/description/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<>Description component</>);
});

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockReturnValue(<p>ProfilePicture</p>);
});
jest.mock(
  'components/Glossary/GlossaryTermTab/GlossaryTermTab.component',
  () => {
    return jest.fn().mockReturnValue(<p>GlossaryTermTab.component</p>);
  }
);
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    )),
  useParams: jest.fn().mockImplementation(() => ({
    glossaryName: 'GlossaryName',
  })),
}));

const mockProps = {
  glossary: mockedGlossaries[0],
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  updateGlossary: jest.fn(),
};

describe('Test Glossary-details component', () => {
  it('Should render Glossary-details component', async () => {
    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });

    const glossaryDetails = screen.getByTestId('glossary-details');
    const tagsContainer = await screen.findByText(/Tags-container component/i);
    const description = await screen.findByText(/Description component/i);
    const tabs = await screen.findAllByRole('tab');

    expect(description).toBeInTheDocument();
    expect(tagsContainer).toBeInTheDocument();
    expect(glossaryDetails).toBeInTheDocument();
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.textContent)).toStrictEqual([
      'label.summary',
      'label.glossary-term-plural',
    ]);
    expect(
      await screen.findByTestId('owner-card-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('reviewer-card-container')
    ).toBeInTheDocument();
  });

  it('onClick of glossary term tab, it should render properly', async () => {
    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });
    const tabs = await screen.findAllByRole('tab');
    await act(async () => {
      fireEvent.click(tabs[1]);
    });

    expect(tabs[1].textContent).toStrictEqual('label.glossary-term-plural');
    expect(
      await screen.findByText('GlossaryTermTab.component')
    ).toBeInTheDocument();
  });
});
