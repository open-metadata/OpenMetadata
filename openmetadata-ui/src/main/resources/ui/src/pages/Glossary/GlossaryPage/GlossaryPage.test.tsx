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
import { MOCK_GLOSSARY } from 'mocks/Glossary.mock';
import React from 'react';
import {
  deleteGlossary,
  deleteGlossaryTerm,
  patchGlossaryTerm,
} from 'rest/glossaryAPI';
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

jest.mock('components/Glossary/GlossaryV1.component', () => {
  return jest.fn().mockImplementation((props) => (
    <div>
      <p> Glossary.component</p>
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
  getGlossariesList: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [MOCK_GLOSSARY] })),
  patchGlossaryTerm: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
  patchGlossaries: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
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

      const updateGlossary = await screen.findByTestId('updateGlossary');

      expect(glossaryComponent).toBeInTheDocument();

      fireEvent.click(updateGlossary);
    });
  });

  it('All Function call should work properly - part 2', async () => {
    await act(async () => {
      render(<GlossaryPage />);

      const glossaryComponent = await screen.findByText(/Glossary.component/i);

      const handleGlossaryTermUpdate = await screen.findByTestId(
        'handleGlossaryTermUpdate'
      );
      const handleGlossaryTermDelete = await screen.findByTestId(
        'handleGlossaryTermDelete'
      );

      expect(glossaryComponent).toBeInTheDocument();

      fireEvent.click(handleGlossaryTermUpdate);
      fireEvent.click(handleGlossaryTermDelete);
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
