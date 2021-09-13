import {
  findByTestId,
  fireEvent,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { AddServiceModal } from './AddServiceModal';

const mockData = {
  connectionUrl: 'string',
  description: 'string',
  driverClass: 'string',
  href: 'string',
  id: 'string',
  jdbc: { driverClass: 'string', connectionUrl: 'string' },
  name: 'string',
  serviceType: 'string',
  ingestionSchedule: { repeatFrequency: 'string', startDate: 'string' },
};

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const mockServiceList = [mockData, mockData, mockData];

describe('Test AddServiceModal Component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="testService"
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
        serviceName="testService"
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

  it('on click of cancel onCancel should be call', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="testService"
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

  it('form with all the fild should render', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="testService"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const name = await findByTestId(container, 'name');
    const url = await findByTestId(container, 'url');
    const port = await findByTestId(container, 'port');
    const userName = await findByTestId(container, 'userName');
    const password = await findByTestId(container, 'password');
    const database = await findByTestId(container, 'database');
    const driverClass = await findByTestId(container, 'driverClass');
    const description = await findByTestId(container, 'description');
    const ingestionSwitch = await findByTestId(container, 'ingestion-switch');

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(name).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(port).toBeInTheDocument();
    expect(userName).toBeInTheDocument();
    expect(password).toBeInTheDocument();
    expect(database).toBeInTheDocument();
    expect(driverClass).toBeInTheDocument();
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
        serviceName="testService"
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
        serviceName="testService"
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
        serviceName="testService"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const selectService = await findByTestId(container, 'selectService');

    fireEvent.change(selectService, {
      target: { value: 'MYSQL' },
    });

    const name = await findByTestId(container, 'name');

    fireEvent.change(name, {
      target: { value: 'test' },
    });

    const url = await findByTestId(container, 'url');

    fireEvent.change(url, {
      target: { value: 'test.123' },
    });

    const port = await findByTestId(container, 'port');

    fireEvent.change(port, {
      target: { value: 123 },
    });

    const userName = await findByTestId(container, 'userName');

    fireEvent.change(userName, {
      target: { value: 'testUser' },
    });

    const password = await findByTestId(container, 'password');

    fireEvent.change(password, {
      target: { value: 'testPwd' },
    });

    const database = await findByTestId(container, 'database');

    fireEvent.change(database, {
      target: { value: 'testdb' },
    });

    const driverClass = await findByTestId(container, 'driverClass');

    fireEvent.change(driverClass, {
      target: { value: 'jdbc' },
    });

    const description = await findByTestId(container, 'description');

    fireEvent.change(description, {
      target: { value: 'testdescription' },
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

    expect(selectService).toHaveValue('MYSQL');
    expect(name).toHaveValue('test');
    expect(url).toHaveValue('test.123');
    expect(port).toHaveValue(123);
    expect(userName).toHaveValue('testUser');
    expect(password).toHaveValue('testPwd');
    expect(database).toHaveValue('testdb');
    expect(driverClass).toHaveValue('jdbc');
    expect(description).toHaveValue('testdescription');
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
