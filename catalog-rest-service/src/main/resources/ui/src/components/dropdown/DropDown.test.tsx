import {
  fireEvent,
  getByTestId,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DropDown from './DropDown';

const mockDropDown = [
  { name: 'Test1', to: '/test1', disabled: false },
  { name: 'Test2', to: '/test2', disabled: false },
  { name: 'Test3', to: '/test3', disabled: false },
];

describe('Test DropDown Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByTestId(container, 'dropdown-item')).toBeInTheDocument();
  });

  it('Dropdown menu should not be visible without clicking on it', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(queryByText(container, 'Test1')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test2')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test3')).not.toBeInTheDocument();
  });

  it('Dropdown menu should be visible by clicking on it', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dropdown = getByTestId(container, 'menu-button');
    fireEvent.click(
      dropdown,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(queryByText(container, 'Test1')).toBeInTheDocument();
    expect(queryByText(container, 'Test2')).toBeInTheDocument();
    expect(queryByText(container, 'Test3')).toBeInTheDocument();
  });

  it('Dropdown menu should not be visible by on 2nd click', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dropdown = getByTestId(container, 'menu-button');
    fireEvent.click(
      dropdown,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(queryByText(container, 'Test1')).toBeInTheDocument();
    expect(queryByText(container, 'Test2')).toBeInTheDocument();
    expect(queryByText(container, 'Test3')).toBeInTheDocument();

    fireEvent.click(
      dropdown,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(queryByText(container, 'Test1')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test2')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test3')).not.toBeInTheDocument();
  });
});
