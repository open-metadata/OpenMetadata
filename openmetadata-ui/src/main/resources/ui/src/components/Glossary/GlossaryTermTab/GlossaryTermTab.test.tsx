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

import { act, render, screen } from '@testing-library/react';
import { mockedGlossaries, mockedGlossaryTerms } from 'mocks/Glossary.mock';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getGlossaryTerms } from 'rest/glossaryAPI';
import GlossaryTermTab from './GlossaryTermTab.component';

jest.mock('rest/glossaryAPI', () => ({
  getGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  patchGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <p data-testid="description">{markdown}</p>
    ))
);

describe('Test GlossaryTermTab component', () => {
  it('No data placeholder should visible if there is no data', async () => {
    (getGlossaryTerms as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    await act(async () => {
      render(
        <GlossaryTermTab
          childGlossaryTerms={[]}
          glossaryId={mockedGlossaries[0].id}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(
      await screen.findByText(
        'message.adding-new-entity-is-easy-just-give-it-a-spin'
      )
    ).toBeInTheDocument();
  });
});
