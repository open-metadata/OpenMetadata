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

import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_FORM_VALUE } from 'constants/Tags.constant';
import React from 'react';
import TagsForm from './TagsForm';

jest.mock('components/common/rich-text-editor/RichTextEditor', () => {
  return jest.fn().mockImplementation(({ initialValue }) => {
    return <div>{initialValue}MarkdownWithPreview component</div>;
  });
});

jest.mock('../../utils/CommonUtils', () => ({
  isUrlFriendlyName: jest.fn().mockReturnValue(true),
}));

const mockCancel = jest.fn();
const mockSubmit = jest.fn();

const MOCK_PROPS = {
  visible: true,
  onCancel: mockCancel,
  header: 'Add Test',
  initialValues: DEFAULT_FORM_VALUE,
  onSubmit: mockSubmit,
  showMutuallyExclusive: false,
  isClassification: false,
  disableName: false,
  isLoading: false,
};

describe('TagForm component', () => {
  it('Rename Modal component should render properly', async () => {
    render(<TagsForm {...MOCK_PROPS} />);

    const modal = await screen.findByTestId('modal-container');

    const modalTitle = await screen.findByText(MOCK_PROPS.header);

    const cancelButton = await screen.findByText('Cancel');
    const submitButton = await screen.findByText('label.save');

    expect(modal).toBeInTheDocument();
    expect(modalTitle).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });

  it('Callback on button click should work', async () => {
    render(<TagsForm {...MOCK_PROPS} />);
    const cancelButton = await screen.findByText('Cancel');

    fireEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('Form component should render properly', async () => {
    render(<TagsForm {...MOCK_PROPS} />);

    const name = await screen.findByTestId('name');

    expect(name).toBeInTheDocument();
    expect(
      await screen.findByText(/MarkdownWithPreview component/i)
    ).toBeInTheDocument();
  });

  it('Form component should render Mutually Exclusive field', async () => {
    render(<TagsForm {...MOCK_PROPS} showMutuallyExclusive />);

    const mutuallyExclusiveLabel = await screen.findByTestId(
      'mutually-exclusive-label'
    );

    const mutuallyExclusiveButton = await screen.findByTestId(
      'mutually-exclusive-button'
    );

    expect(mutuallyExclusiveLabel).toBeInTheDocument();
    expect(mutuallyExclusiveButton).toBeInTheDocument();
  });
});
