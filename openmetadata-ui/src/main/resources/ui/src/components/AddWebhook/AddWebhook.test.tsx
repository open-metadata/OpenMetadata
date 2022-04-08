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
  act,
  findAllByText,
  findByTestId,
  findByText,
  fireEvent,
  queryByTestId,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { FormSubmitType } from '../../enums/form.enum';
import { Webhook } from '../../generated/entity/events/webhook';
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

const mockDropdownFunction = jest.fn().mockImplementation((fn) => {
  fn('event', 'test');
});

jest.mock('../dropdown/DropDown', () => {
  return jest
    .fn()
    .mockImplementation(({ onSelect }) => (
      <p onClick={() => mockDropdownFunction(onSelect)}>DropDown.component</p>
    ));
});

jest.mock('../buttons/CopyToClipboardButton/CopyToClipboardButton', () => {
  return jest
    .fn()
    .mockImplementation(() => <p>CopyToClipboardButton.component</p>);
});

jest.mock('../common/rich-text-editor/RichTextEditor', () => {
  return jest
    .fn()
    .mockImplementation(() => <p>MarkdownWithPreview.component</p>);
});

jest.mock('../Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest.fn().mockImplementation(({ onCancel, onConfirm }) => (
    <div>
      <p>ConfirmationModal.component</p>
      <button onClick={onCancel}>cancelModal</button>
      <button onClick={onConfirm}>confirmDelete</button>
    </div>
  ));
});

const mockData = {
  id: 'c0a00c5a-4687-4508-b23d-ab9a2996a8e0',
  name: 'test hook',
  endpoint: 'http://test.com',
  eventFilters: [
    {
      eventType: 'entityCreated',
      entities: ['*'],
    },
  ],
  batchSize: 10,
  timeout: 10,
  enabled: true,
  secretKey: 'Lgo71tlvzAyQYm2U1Al3wxmU86SGkJ2ceHtRUsZN2BCwW97RfT',
  version: 0.1,
  updatedAt: 1649319208832,
  updatedBy: 'anonymous',
  status: 'active',
  href: 'http://localhost:8585/api/v1/webhook/c0a00c5a-4687-4508-b23d-ab9a2996a8e0',
  deleted: false,
};

const addWebhookProps: AddWebhookProps = {
  header: 'add webhook',
  mode: FormSubmitType.ADD,
  onCancel: jest.fn(),
  onSave: jest.fn(),
  onDelete: jest.fn(),
  saveState: 'initial',
  deleteState: 'initial',
  allowAccess: true,
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
    const active = await findByTestId(container, 'active');
    const entityCreatedCheckbox = await findByTestId(
      container,
      'entity-created-checkbox'
    );
    const entityUpdatedCheckbox = await findByTestId(
      container,
      'entity-updated-checkbox'
    );
    const entityDeletedCheckbox = await findByTestId(
      container,
      'entity-deleted-checkbox'
    );
    const showAdvancedButton = await findByTestId(container, 'show-advanced');
    const cancelWebhook = await findByTestId(container, 'cancel-webhook');
    const saveWebhook = await findByTestId(container, 'save-webhook');
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
    expect(active).toBeInTheDocument();
    expect(entityCreatedCheckbox).toBeInTheDocument();
    expect(entityUpdatedCheckbox).toBeInTheDocument();
    expect(entityDeletedCheckbox).toBeInTheDocument();
    expect(showAdvancedButton).toBeInTheDocument();
    expect(cancelWebhook).toBeInTheDocument();
    expect(saveWebhook).toBeInTheDocument();
    expect(dropdown.length).toBe(3);
  });

  it('Input fields should work properly', async () => {
    const { container } = render(<AddWebhook {...addWebhookProps} />, {
      wrapper: MemoryRouter,
    });

    const endpointUrl = await findByTestId(container, 'endpoint-url');
    const nameField = await findByTestId(container, 'name');
    const active = await findByTestId(container, 'active');
    const entityCreatedCheckbox = await findByTestId(
      container,
      'entity-created-checkbox'
    );
    const entityUpdatedCheckbox = await findByTestId(
      container,
      'entity-updated-checkbox'
    );
    const entityDeletedCheckbox = await findByTestId(
      container,
      'entity-deleted-checkbox'
    );
    const dropdown = await findAllByText(container, /DropDown.component/i);
    const saveWebhook = await findByTestId(container, 'save-webhook');
    const cancelWebhook = await findByTestId(container, 'cancel-webhook');

    fireEvent.click(saveWebhook);

    expect(
      await findByText(container, 'Webhook name is required.')
    ).toBeInTheDocument();
    expect(
      await findByText(container, 'Webhook endpoint is required.')
    ).toBeInTheDocument();
    expect(
      await findByText(container, 'Webhook event filters are required.')
    ).toBeInTheDocument();
    expect(active).toHaveClass('open');
    expect(entityCreatedCheckbox).not.toBeChecked();
    expect(entityUpdatedCheckbox).not.toBeChecked();
    expect(entityDeletedCheckbox).not.toBeChecked();

    fireEvent.change(nameField, {
      target: {
        value: 'name field',
      },
    });
    fireEvent.change(endpointUrl, {
      target: {
        value: 'http://test.com',
      },
    });
    fireEvent.click(active);
    fireEvent.click(entityCreatedCheckbox);
    fireEvent.click(entityUpdatedCheckbox);
    fireEvent.click(entityDeletedCheckbox);
    fireEvent.click(dropdown[0]);
    fireEvent.click(dropdown[1]);
    fireEvent.click(dropdown[2]);

    expect(nameField).toHaveValue('name field');
    expect(endpointUrl).toHaveValue('http://test.com');
    expect(active).not.toHaveClass('open');
    expect(entityCreatedCheckbox).toBeChecked();
    expect(entityUpdatedCheckbox).toBeChecked();
    expect(entityDeletedCheckbox).toBeChecked();
    expect(mockDropdownFunction).toBeCalledTimes(3);

    fireEvent.click(saveWebhook);
    fireEvent.click(cancelWebhook);

    expect(addWebhookProps.onSave).toBeCalledTimes(1);
    expect(addWebhookProps.onCancel).toBeCalledTimes(1);
  });

  it('onClick of show advance config, appropriate field should be visible', async () => {
    await act(async () => {
      const { container } = render(<AddWebhook {...addWebhookProps} />, {
        wrapper: MemoryRouter,
      });

      const showAdvancedButton = await findByTestId(container, 'show-advanced');

      expect(showAdvancedButton).toBeInTheDocument();

      fireEvent.click(showAdvancedButton);

      // advance config fields tests
      const batchSize = await findByTestId(container, 'batch-size');
      const connectionTimeout = await findByTestId(
        container,
        'connection-timeout'
      );
      const secretKey = await findByTestId(container, 'secret-key');
      const generateSecretButtom = await findByTestId(
        container,
        'generate-secret'
      );

      expect(batchSize).toBeInTheDocument();
      expect(connectionTimeout).toBeInTheDocument();
      expect(secretKey).toBeInTheDocument();
      expect(secretKey).toHaveValue('');
      expect(secretKey).toHaveAttribute('readOnly');
      expect(generateSecretButtom).toBeInTheDocument();

      fireEvent.change(batchSize, {
        target: {
          value: 'batchSize',
        },
      });
      fireEvent.change(connectionTimeout, {
        target: {
          value: 'connectionTimeout',
        },
      });

      // string should not added as its number feild
      expect(batchSize).not.toHaveValue('batchSize');
      expect(connectionTimeout).not.toHaveValue('connectionTimeout');

      fireEvent.change(batchSize, {
        target: {
          value: 10,
        },
      });
      fireEvent.change(connectionTimeout, {
        target: {
          value: 10,
        },
      });

      expect(batchSize).toHaveValue(10);
      expect(connectionTimeout).toHaveValue(10);
    });
  });

  it('secret key generation should work properly', async () => {
    await act(async () => {
      const { container } = render(<AddWebhook {...addWebhookProps} />, {
        wrapper: MemoryRouter,
      });
      jest.useFakeTimers();

      const showAdvancedButton = await findByTestId(container, 'show-advanced');

      expect(showAdvancedButton).toBeInTheDocument();

      fireEvent.click(showAdvancedButton);

      const secretKey = await findByTestId(container, 'secret-key');
      const generateSecretButtom = await findByTestId(
        container,
        'generate-secret'
      );

      expect(secretKey).toHaveValue('');
      expect(
        queryByText(container, 'CopyToClipboardButton.component')
      ).not.toBeInTheDocument();
      expect(queryByTestId(container, 'clear-secret')).not.toBeInTheDocument();

      fireEvent.click(generateSecretButtom);
      jest.runAllTimers();

      expect(secretKey).toHaveValue();
      expect(
        await findByText(container, 'CopyToClipboardButton.component')
      ).toBeInTheDocument();
      expect(await findByTestId(container, 'clear-secret')).toBeInTheDocument();

      // onClick of delete secret test
      fireEvent.click(await findByTestId(container, 'clear-secret'));

      expect(
        queryByText(container, 'CopyToClipboardButton.component')
      ).not.toBeInTheDocument();
      expect(queryByTestId(container, 'clear-secret')).not.toBeInTheDocument();
      expect(secretKey).toHaveValue('');
    });
  });

  it('If data is provided, it should work accordingly', async () => {
    await act(async () => {
      const { container } = render(
        <AddWebhook
          {...addWebhookProps}
          data={mockData as Webhook}
          header="Edit Webhook"
          mode={FormSubmitType.EDIT}
        />,
        {
          wrapper: MemoryRouter,
        }
      );

      const header = await findByTestId(container, 'header');
      const deleteWebhook = await findByTestId(container, 'delete-webhook');

      expect(header).toBeInTheDocument();
      expect(await findByText(container, 'Edit Webhook')).toBeInTheDocument();
      expect(deleteWebhook).toBeInTheDocument();
      expect(
        queryByText(container, 'ConfirmationModal.component')
      ).not.toBeInTheDocument();

      fireEvent.click(deleteWebhook);

      // on click of delete button confirmation modal should open
      expect(
        queryByText(container, 'ConfirmationModal.component')
      ).toBeInTheDocument();

      // on click of cancelModal confirmation modal should close
      fireEvent.click(await findByText(container, 'cancelModal'));

      expect(
        queryByText(container, 'ConfirmationModal.component')
      ).not.toBeInTheDocument();

      fireEvent.click(deleteWebhook);

      expect(
        queryByText(container, 'ConfirmationModal.component')
      ).toBeInTheDocument();

      // on click of confirmDelete delete function should call
      fireEvent.click(await findByText(container, 'confirmDelete'));

      expect(addWebhookProps.onDelete).toBeCalled();
    });
  });
});
