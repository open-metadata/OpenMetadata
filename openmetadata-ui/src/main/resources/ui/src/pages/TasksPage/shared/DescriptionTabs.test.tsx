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
import { forwardRef } from 'react';
import { DescriptionTabs } from './DescriptionTabs';

jest.mock('../../../utils/TasksUtils', () => ({
  getDescriptionDiff: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../components/common/RichTextEditor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(({ initialValue }) => {
      return (
        <div
          data-testid="richTextEditor"
          ref={(input) => {
            return { getEditorContent: input };
          }}>
          {initialValue}RichTextEditor
        </div>
      );
    })
  );
});

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    jest
      .fn()
      .mockReturnValue(
        <div data-testid="richTextEditorPreviewer">RichTextEditorPreviewer</div>
      )
);

jest.mock('./DiffView/DiffView', () =>
  jest.fn().mockReturnValue(<div data-testid="DiffView">DiffView</div>)
);

const mockProps = {
  value: 'description',
  suggestion: 'suggestion',
  markdownRef: { current: undefined },
  placeHolder: '',
  onChange: jest.fn(),
};

const tabList = ['Current', 'Diff', 'New'];

describe('Test Description Tabs Component', () => {
  it('Should render the component', async () => {
    render(<DescriptionTabs {...mockProps} />);

    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(tabList.length);

    expect(await screen.findByText('Current')).toBeInTheDocument();
    expect(await screen.findByText('Diff')).toBeInTheDocument();
    expect(await screen.findByText('New')).toBeInTheDocument();
  });

  it('Should render the component relevant tab component', async () => {
    render(<DescriptionTabs {...mockProps} />);

    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(tabList.length);

    act(() => {
      fireEvent.click(tabs[0]);
    });

    expect(
      await screen.findByTestId('richTextEditorPreviewer')
    ).toBeInTheDocument();

    act(() => {
      fireEvent.click(tabs[1]);
    });

    expect(await screen.findByTestId('DiffView')).toBeInTheDocument();

    act(() => {
      fireEvent.click(tabs[2]);
    });

    expect(await screen.findByTestId('richTextEditor')).toBeInTheDocument();
  });
});
