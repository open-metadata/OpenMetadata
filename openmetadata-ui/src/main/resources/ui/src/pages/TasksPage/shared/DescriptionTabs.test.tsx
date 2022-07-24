/*
 *  Copyright 2021 Collate
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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DescriptionTabs } from './DescriptionTabs';

jest.mock('../../../utils/TasksUtils', () => ({
  getDescriptionDiff: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../components/common/rich-text-editor/RichTextEditor', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="richTextEditor">RichTextEditor</div>)
);

jest.mock(
  '../../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () =>
    jest
      .fn()
      .mockReturnValue(
        <div data-testid="richTextEditorPreviewer">RichTextEditorPreviewer</div>
      )
);

jest.mock('./DiffView', () => ({
  DiffView: jest
    .fn()
    .mockReturnValue(<div data-testid="DiffView">DiffView</div>),
}));

const mockProps = {
  description: 'description',
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

    tabs.forEach(async (_tab, index) => {
      expect(await screen.findByText(tabList[index])).toBeInTheDocument();
    });
  });

  it('Should render the component relavant tab component', async () => {
    render(<DescriptionTabs {...mockProps} />);

    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(tabList.length);

    fireEvent.click(tabs[0]);

    expect(
      await screen.findByTestId('richTextEditorPreviewer')
    ).toBeInTheDocument();

    fireEvent.click(tabs[1]);

    expect(await screen.findByTestId('DiffView')).toBeInTheDocument();

    fireEvent.click(tabs[2]);

    expect(await screen.findByTestId('richTextEditor')).toBeInTheDocument();
  });
});
