/*
 *  Copyright 2026 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';
import { CursorType } from '../../enums/pagination.enum';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import StoredProcedureTab from './StoredProcedureTab';

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ currentUser: { name: 'paging-user' } })
  ),
}));

jest.mock('../../components/common/NextPrevious/NextPrevious', () =>
  jest
    .fn()
    .mockImplementation(({ currentPage, pagingHandler }: NextPreviousProps) => (
      <button
        data-testid="next-page"
        onClick={() =>
          pagingHandler({
            cursorType: CursorType.AFTER,
            currentPage: currentPage + 1,
          })
        }>
        {`page-${currentPage}`}
      </button>
    ))
);

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn().mockImplementation(() => <p>testRichTextEditorPreviewer</p>)
);

jest.mock('../../rest/storedProceduresAPI', () => ({
  getStoredProceduresList: jest.fn().mockResolvedValue({
    data: [],
    paging: { after: 'page-2-cursor', total: 30 },
  }),
}));

describe('StoredProcedureTab with a real router', () => {
  it('stays on the next page after paging forward', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <StoredProcedureTab />
        </MemoryRouter>
      );
    });

    await act(async () => {
      fireEvent.click(await screen.findByTestId('next-page'));
    });

    expect(screen.getByTestId('next-page')).toHaveTextContent('page-2');
    expect(getStoredProceduresList).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: 'page-2-cursor' })
    );
  });
});
