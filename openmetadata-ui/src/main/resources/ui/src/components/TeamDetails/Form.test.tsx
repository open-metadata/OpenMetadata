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

import { findByTestId, findByText, render } from '@testing-library/react';
import React, { forwardRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import Form from './Form';

const mockFunction = jest.fn();

jest.mock('components/common/rich-text-editor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(({ initialValue }, ref) => {
      return <div ref={ref}>{initialValue}MarkdownWithPreview component</div>;
    })
  );
});

describe('Test TeamsPage Form component', () => {
  it('Form component should render properly', async () => {
    const { container } = render(
      <Form
        initialData={{
          id: '',
          name: '',
          displayName: '',
          description: '',
          href: '',
          users: [],
          owns: [],
        }}
        saveData={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const name = await findByTestId(container, 'name');
    const displayName = await findByTestId(container, 'displayName');

    expect(name).toBeInTheDocument();
    expect(displayName).toBeInTheDocument();
    expect(
      await findByText(container, /MarkdownWithPreview component/i)
    ).toBeInTheDocument();
  });
});
