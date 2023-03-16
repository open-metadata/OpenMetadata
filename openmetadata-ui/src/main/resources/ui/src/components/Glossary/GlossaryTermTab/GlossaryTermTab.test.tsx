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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { mockedGlossaries, mockedGlossaryTerms } from 'mocks/Glossary.mock';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getGlossaryTerms, patchGlossaryTerm } from 'rest/glossaryAPI';
import GlossaryTermTab from './GlossaryTermTab.component';

jest.mock('rest/glossaryAPI', () => ({
  getGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  patchGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('components/common/searchbar/Searchbar', () => {
  return jest
    .fn()
    .mockImplementation(({ searchValue, onSearch }) => (
      <input
        data-testid="search-box"
        type="text"
        value={searchValue}
        onChange={(e) => onSearch(e.target.value)}
      />
    ));
});
jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <p data-testid="description">{markdown}</p>
    ))
);

describe('Test GlossaryTermTab component', () => {
  it('GlossaryTermTab Page Should render', async () => {
    act(() => {
      render(<GlossaryTermTab glossaryId={mockedGlossaries[0].id} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByTestId('search-box')).toBeInTheDocument();
    expect(
      await screen.findByText(mockedGlossaryTerms[0].name)
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-new-tag-button')).toBeInTheDocument();
    expect(await screen.findAllByTestId('description')).toHaveLength(2);
    expect(
      await screen.findByText(mockedGlossaryTerms[0].name)
    ).toBeInTheDocument();
    expect(await screen.findByText('label.tag-plural')).toBeInTheDocument();
    expect(await screen.findByText('label.term-plural')).toBeInTheDocument();
    expect(await screen.findByText('label.description')).toBeInTheDocument();
    expect(
      await screen.findByText(mockedGlossaryTerms[0].description)
    ).toBeInTheDocument();
  });

  it('If Glossaryid is provided API should go accordingly', async () => {
    const mockGetGlossaryTerms = getGlossaryTerms as jest.Mock;
    await act(async () => {
      render(<GlossaryTermTab glossaryId={mockedGlossaries[0].id} />, {
        wrapper: MemoryRouter,
      });
    });
    const params = mockGetGlossaryTerms.mock.calls[0][0];

    expect(mockGetGlossaryTerms.mock.calls).toHaveLength(1);
    expect(params.glossary).toBe(mockedGlossaries[0].id);
    expect(params.parent).toBeUndefined();
  });

  it('If glossaryTermId is provided API should go accordingly', async () => {
    const mockGetGlossaryTerms = getGlossaryTerms as jest.Mock;
    await act(async () => {
      render(<GlossaryTermTab glossaryTermId={mockedGlossaryTerms[0].id} />, {
        wrapper: MemoryRouter,
      });
    });
    const params = mockGetGlossaryTerms.mock.calls[0][0];

    expect(mockGetGlossaryTerms.mock.calls).toHaveLength(1);
    expect(params.parent).toBe(mockedGlossaryTerms[0].id);
    expect(params.glossary).toBeUndefined();
  });

  it('Search functionality should work properly', async () => {
    const searchTerm = 'testSearch';
    await act(async () => {
      render(<GlossaryTermTab glossaryId={mockedGlossaries[0].id} />, {
        wrapper: MemoryRouter,
      });
    });

    const searchbox = await screen.findByTestId('search-box');

    expect(searchbox).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(searchbox, { target: { value: searchTerm } });
    });

    expect(await screen.findByTestId('search-box')).toBeInTheDocument();
    expect(
      await screen.findByText('message.no-entity-found-for-name')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(searchbox, { target: { value: '' } });
    });

    expect(
      await screen.findByText(mockedGlossaryTerms[0].name)
    ).toBeInTheDocument();
  });

  it('Move glossaryTerm to another term', async () => {
    const mockPatchGlossaryTerm = patchGlossaryTerm as jest.Mock;
    const mockGetGlossaryTerms = getGlossaryTerms as jest.Mock;
    await act(async () => {
      render(<GlossaryTermTab glossaryId={mockedGlossaries[0].id} />, {
        wrapper: MemoryRouter,
      });
    });
    const tableRows = await screen.findAllByRole('row');
    const firstGlossary = tableRows[1];
    const secondGlossary = tableRows[2];

    await act(async () => {
      fireEvent.dragStart(firstGlossary);
      fireEvent.dragEnter(secondGlossary);
      fireEvent.dragOver(secondGlossary);
      fireEvent.drop(secondGlossary);
    });

    const modal = await screen.findByTestId('confirmation-modal');
    const confirmBtn = await screen.findByText('label.confirm');

    expect(modal).toBeInTheDocument();
    expect(confirmBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    const id = mockPatchGlossaryTerm.mock.calls[0][0];
    const jsonPatch = mockPatchGlossaryTerm.mock.calls[0][1];
    const params = mockGetGlossaryTerms.mock.calls[1][0];

    expect(mockPatchGlossaryTerm.mock.calls).toHaveLength(1);
    expect(id).toStrictEqual(mockedGlossaryTerms[0].id);
    expect(jsonPatch).toStrictEqual([
      {
        op: 'add',
        path: '/parent',
        value: { fullyQualifiedName: 'Business Glossary.Sales' },
      },
    ]);
    expect(mockGetGlossaryTerms.mock.calls).toHaveLength(2);
    expect(params.glossary).toBe(mockedGlossaries[0].id);
    expect(params.parent).toBeUndefined();
  });

  it('No data placeholder should visible if there is no data', async () => {
    (getGlossaryTerms as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    await act(async () => {
      render(<GlossaryTermTab glossaryId={mockedGlossaries[0].id} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.queryByTestId('search-box')).not.toBeInTheDocument();
    expect(
      await screen.findByText('message.no-entity-data-available')
    ).toBeInTheDocument();
  });
});
