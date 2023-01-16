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
import {
  deleteGlossary,
  deleteGlossaryTerm,
  patchGlossaryTerm,
} from 'rest/glossaryAPI';
import { mockSearchData, MOCK_GLOSSARY } from './glossary.mock';
import GlossaryPage from './GlossaryPage.component';

jest.useRealTimers();

jest.mock('react-router-dom', () => ({
  useHistory: () => ({
    push: jest.fn(),
  }),
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
}));

jest.mock('rest/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockSearchData)),
}));

jest.mock('components/Glossary/GlossaryV1.component', () => {
  return jest.fn().mockImplementation((props) => (
    <div>
      <p> Glossary.component</p>
      <button
        data-testid="handleAddGlossaryClick"
        onClick={props.handleAddGlossaryClick}>
        handleAddGlossaryClick
      </button>
      <button
        data-testid="handleAddGlossaryTermClick"
        onClick={props.handleAddGlossaryTermClick}>
        handleAddGlossaryTermClick
      </button>
      <button
        data-testid="handleChildLoading"
        onClick={() => props.handleChildLoading(false)}>
        handleChildLoading
      </button>
      <button
        data-testid="handleExpandedKey"
        onClick={() => props.handleExpandedKey(['test', 'test1'], true)}>
        handleExpandedKey
      </button>
      <button
        data-testid="handleExpandedKeyDefaultValue"
        onClick={() => props.handleExpandedKey(['test', 'test1'], false)}>
        handleExpandedKeyDefaultValue
      </button>
      <button
        data-testid="handleGlossaryTermUpdate"
        onClick={() => props.handleGlossaryTermUpdate(MOCK_GLOSSARY)}>
        handleGlossaryTermUpdate
      </button>
      <button
        data-testid="handleGlossaryDelete"
        onClick={() => props.onGlossaryDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryDelete
      </button>
      <button
        data-testid="handleGlossaryTermDelete"
        onClick={() => props.onGlossaryTermDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryTermDelete
      </button>
      <button
        data-testid="handleRelatedTermClick"
        onClick={() => props.onRelatedTermClick(MOCK_GLOSSARY.id)}>
        handleRelatedTermClick
      </button>
      <button
        data-testid="handleAssetPagination"
        onClick={() => props.onAssetPaginate('next')}>
        handleAssetPagination
      </button>
      <button
        data-testid="handleUserRedirection"
        onClick={() => props.handleUserRedirection('test')}>
        handleUserRedirection
      </button>
      <button
        data-testid="handleSearchText"
        onClick={() => props.handleSearchText('test')}>
        handleSearchText
      </button>
      <button
        data-testid="updateGlossary"
        onClick={() => props.updateGlossary(MOCK_GLOSSARY)}>
        updateGlossary
      </button>
    </div>
  ));
});

jest.mock('rest/glossaryAPI', () => ({
  deleteGlossary: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  patchGlossaryTerm: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
  patchGlossaries: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
}));

jest.mock('../../utils/GlossaryUtils', () => ({
  getGlossariesWithRootTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve([MOCK_GLOSSARY])),
  getHierarchicalKeysByFQN: jest.fn().mockReturnValue(['test', 'test1']),
  getChildGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [MOCK_GLOSSARY] })),
  getTermDataFromGlossary: jest.fn().mockReturnValue(MOCK_GLOSSARY),
  getTermPosFromGlossaries: jest.fn().mockReturnValue([1, 2]),
  updateGlossaryListBySearchedTerms: jest.fn().mockReturnValue([MOCK_GLOSSARY]),
}));

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    render(<GlossaryPage />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    expect(glossaryComponent).toBeInTheDocument();
  });

  it('All Function call should work properly - part 1', async () => {
    await act(async () => {
      render(<GlossaryPage />);

      const glossaryComponent = await screen.findByText(/Glossary.component/i);
      const handleExpandedKeyDefaultValue = await screen.findByTestId(
        'handleExpandedKeyDefaultValue'
      );
      const handleRelatedTermClick = await screen.findByTestId(
        'handleRelatedTermClick'
      );
      const handleAssetPagination = await screen.findByTestId(
        'handleAssetPagination'
      );
      const handleUserRedirection = await screen.findByTestId(
        'handleUserRedirection'
      );
      const updateGlossary = await screen.findByTestId('updateGlossary');

      expect(glossaryComponent).toBeInTheDocument();

      fireEvent.click(handleExpandedKeyDefaultValue);
      fireEvent.click(handleRelatedTermClick);
      fireEvent.click(handleAssetPagination);
      fireEvent.click(handleUserRedirection);
      fireEvent.click(updateGlossary);
    });
  });

  it('All Function call should work properly - part 2', async () => {
    await act(async () => {
      render(<GlossaryPage />);

      const glossaryComponent = await screen.findByText(/Glossary.component/i);
      const handleAddGlossaryClick = await screen.findByTestId(
        'handleAddGlossaryClick'
      );
      const handleAddGlossaryTermClick = await screen.findByTestId(
        'handleAddGlossaryTermClick'
      );
      const handleChildLoading = await screen.findByTestId(
        'handleChildLoading'
      );
      const handleExpandedKey = await screen.findByTestId('handleExpandedKey');
      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );
      const handleGlossaryTermUpdate = await screen.findByTestId(
        'handleGlossaryTermUpdate'
      );
      const handleGlossaryTermDelete = await screen.findByTestId(
        'handleGlossaryTermDelete'
      );
      const handleSearchText = await screen.findByTestId('handleSearchText');

      expect(glossaryComponent).toBeInTheDocument();

      fireEvent.click(handleAddGlossaryClick);
      fireEvent.click(handleAddGlossaryTermClick);
      fireEvent.click(handleChildLoading);
      fireEvent.click(handleExpandedKey);
      fireEvent.click(handleGlossaryDelete);

      fireEvent.click(handleGlossaryTermUpdate);
      fireEvent.click(handleGlossaryTermDelete);

      fireEvent.click(handleSearchText);
    });
  });

  describe('Render Sad Paths', () => {
    it('show error if deleteGlossaryTerm API fails', async () => {
      (deleteGlossaryTerm as jest.Mock).mockImplementationOnce(() =>
        Promise.reject()
      );
      render(<GlossaryPage />);
      const handleGlossaryTermDelete = await screen.findByTestId(
        'handleGlossaryTermDelete'
      );

      expect(handleGlossaryTermDelete).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryTermDelete);
      });
    });

    it('show error if deleteGlossary API fails', async () => {
      (deleteGlossary as jest.Mock).mockImplementationOnce(() =>
        Promise.reject()
      );
      render(<GlossaryPage />);
      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      expect(handleGlossaryDelete).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });
    });

    it('show error if patchGlossaryTerm API resolves without data', async () => {
      (patchGlossaryTerm as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      render(<GlossaryPage />);
      const handleGlossaryTermUpdate = await screen.findByTestId(
        'handleGlossaryTermUpdate'
      );

      expect(handleGlossaryTermUpdate).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryTermUpdate);
      });
    });
  });
});
