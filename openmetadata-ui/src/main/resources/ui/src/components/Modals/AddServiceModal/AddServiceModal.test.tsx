import {
  findByTestId,
  fireEvent,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { AddServiceModal, ServiceDataObj } from './AddServiceModal';

const mockData = {
  description: 'string',
  href: 'string',
  id: 'string',
  jdbc: { driverClass: 'string', connectionUrl: 'string' },
  name: 'string',
  serviceType: 'string',
  ingestionSchedule: { repeatFrequency: 'string', startDate: 'string' },
};

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const mockServiceList: Array<ServiceDataObj> = [{ name: mockData.name }];

jest.mock('../../common/editor/MarkdownWithPreview', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="description">MarkdownWithPreview</p>);
});

describe('Test AddServiceModal Component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const serviceModal = await findByTestId(container, 'service-modal');

    expect(serviceModal).toBeInTheDocument();
  });

  it('onClick of cancel onCancel should be call', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const cancel = await findByTestId(container, 'cancel');
    fireEvent.click(
      cancel,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnCancel).toBeCalledTimes(1);
  });

  it('form with all the Field should render for databaseService', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="databaseServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const name = await findByTestId(container, 'name');
    const url = await findByTestId(container, 'url');
    const database = await findByTestId(container, 'database');
    const driverClass = await findByTestId(container, 'driverClass');
    const description = await findByTestId(container, 'description');
    const ingestionSwitch = await findByTestId(container, 'ingestion-switch');

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(database).toBeInTheDocument();
    expect(driverClass).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(ingestionSwitch).toBeInTheDocument();
    expect(queryByText(container, /day/i)).not.toBeInTheDocument();
    expect(queryByText(container, /hour/i)).not.toBeInTheDocument();
    expect(queryByText(container, /minute/i)).not.toBeInTheDocument();
  });

  it('form with all the Field should render for dashboardServices', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const name = await findByTestId(container, 'name');
    const url = await findByTestId(container, 'dashboard-url');
    const userName = await findByTestId(container, 'username');
    const password = await findByTestId(container, 'password');
    const description = await findByTestId(container, 'description');
    const ingestionSwitch = await findByTestId(container, 'ingestion-switch');

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(userName).toBeInTheDocument();
    expect(password).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(ingestionSwitch).toBeInTheDocument();
    expect(queryByText(container, /day/i)).not.toBeInTheDocument();
    expect(queryByText(container, /hour/i)).not.toBeInTheDocument();
    expect(queryByText(container, /minute/i)).not.toBeInTheDocument();
  });

  it('form with all the Field should render for messagingServices', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="messagingServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const name = await findByTestId(container, 'name');
    const url = await findByTestId(container, 'broker-url');
    const schemaRegistry = await findByTestId(container, 'schema-registry');
    const description = await findByTestId(container, 'description');
    const ingestionSwitch = await findByTestId(container, 'ingestion-switch');

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(schemaRegistry).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(ingestionSwitch).toBeInTheDocument();
    expect(queryByText(container, /day/i)).not.toBeInTheDocument();
    expect(queryByText(container, /hour/i)).not.toBeInTheDocument();
    expect(queryByText(container, /minute/i)).not.toBeInTheDocument();
  });

  it('frequency fileds should be visible when ingestionSwitch is on', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const ingestionSwitch = await findByTestId(container, 'ingestion-switch');
    fireEvent.click(
      ingestionSwitch,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    const frequency = await findByTestId(container, 'frequency');
    const hour = await findByTestId(container, 'hour');
    const minute = await findByTestId(container, 'minute');

    expect(frequency).toBeInTheDocument();
    expect(hour).toBeInTheDocument();
    expect(minute).toBeInTheDocument();
  });

  it('onClick of save button without adding input, form should not submit', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const save = await findByTestId(container, 'save-button');
    fireEvent.click(
      save,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnSave).not.toBeCalled();
  });

  it('onClick of save button with adding input, form should be submit', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="databaseServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const selectService = await findByTestId(container, 'selectService');

    fireEvent.change(selectService, {
      target: { value: 'MySQL' },
    });

    const name = await findByTestId(container, 'name');

    fireEvent.change(name, {
      target: { value: 'test' },
    });

    const url = await findByTestId(container, 'url');

    fireEvent.change(url, {
      target: { value: 'test.123' },
    });

    const database = await findByTestId(container, 'database');

    fireEvent.change(database, {
      target: { value: 'testdb' },
    });

    const driverClass = await findByTestId(container, 'driverClass');

    fireEvent.change(driverClass, {
      target: { value: 'jdbc' },
    });

    const ingestionSwitch = await findByTestId(container, 'ingestion-switch');

    fireEvent.click(
      ingestionSwitch,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    const frequency = await findByTestId(container, 'frequency');

    fireEvent.change(frequency, {
      target: { value: 1 },
    });

    const hour = await findByTestId(container, 'hour');

    fireEvent.change(hour, {
      target: { value: 1 },
    });

    const minute = await findByTestId(container, 'minute');

    fireEvent.change(minute, {
      target: { value: 1 },
    });

    expect(selectService).toHaveValue('MySQL');
    expect(name).toHaveValue('test');
    expect(url).toHaveValue('test.123');
    expect(database).toHaveValue('testdb');
    expect(driverClass).toHaveValue('jdbc');
    expect(frequency).toHaveValue('1');
    expect(hour).toHaveValue('1');
    expect(minute).toHaveValue('1');

    const save = await findByTestId(container, 'save-button');
    fireEvent.click(
      save,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnSave).toBeCalledTimes(1);
  });
});
