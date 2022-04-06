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

import {
  findAllByText,
  findByTestId,
  findByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { FormSubmitType } from '../../enums/form.enum';
import AddWebhook from './AddWebhook';
import { AddWebhookProps } from './AddWebhook.interface';

jest.mock(
  '../containers/PageLayout',
  () =>
    ({
      children,
      rightPanel,
    }: {
      children: React.ReactNode;
      rightPanel: React.ReactNode;
    }) =>
      (
        <div data-testid="PageLayout">
          <div data-testid="right-panel-content">{rightPanel}</div>
          {children}
        </div>
      )
);

jest.mock('../dropdown/DropDown', () => {
  return jest.fn().mockImplementation(() => <p>DropDown.component</p>);
});

jest.mock('../common/editor/MarkdownWithPreview', () => {
  return jest
    .fn()
    .mockImplementation(() => <p>MarkdownWithPreview.component</p>);
});

const addWebhookProps: AddWebhookProps = {
  header: 'add webhook',
  mode: FormSubmitType.ADD,
  onCancel: jest.fn(),
  onSave: jest.fn(),
};

describe('Test AddWebhook component', () => {
  it('Component should render properly', async () => {
    const { container } = render(<AddWebhook {...addWebhookProps} />, {
      wrapper: MemoryRouter,
    });

    const pageLayout = await findByTestId(container, 'PageLayout');
    const rightPanel = await findByTestId(container, 'right-panel-content');
    const header = await findByTestId(container, 'header');
    const formContainer = await findByTestId(container, 'formContainer');
    const nameField = await findByTestId(container, 'name');
    const markdownWithPreview = await findByText(
      container,
      /MarkdownWithPreview.component/i
    );
    const endpointUrl = await findByTestId(container, 'endpoint-url');
    const dropdown = await findAllByText(container, /DropDown.component/i);

    expect(pageLayout).toBeInTheDocument();
    expect(rightPanel).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(
      await findByText(container, addWebhookProps.header)
    ).toBeInTheDocument();
    expect(formContainer).toBeInTheDocument();
    expect(nameField).toBeInTheDocument();
    expect(markdownWithPreview).toBeInTheDocument();
    expect(endpointUrl).toBeInTheDocument();
    expect(dropdown.length).toBe(3);
  });
});
