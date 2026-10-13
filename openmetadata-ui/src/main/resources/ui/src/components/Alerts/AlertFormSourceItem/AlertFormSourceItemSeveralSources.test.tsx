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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_FILTER_RESOURCES } from '../../../test/unit/mocks/observability.mock';
import AlertFormSourceItem from './AlertFormSourceItem';

const mockSetFieldValue = jest.fn();

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'an-alert' }),
}));

jest.mock('../AlertSourcePicker/AlertSourcePicker', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        onChange,
      }: {
        onChange: (v: string[], previous: string[]) => void;
      }) => (
        <>
          <button
            data-testid="add-topic"
            onClick={() => onChange(['table', 'topic'], ['table'])}>
            add topic
          </button>
          <button
            data-testid="only-topic"
            onClick={() => onChange(['topic'], ['table'])}>
            only topic
          </button>
        </>
      )
    )
);

jest.mock('antd', () => {
  const antd = jest.requireActual('antd');

  return {
    ...antd,
    Form: {
      ...antd.Form,
      useFormInstance: jest.fn().mockImplementation(() => ({
        setFieldValue: mockSetFieldValue,
        getFieldValue: jest.fn(),
      })),
    },
  };
});

const renderItem = () =>
  render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />, {
    wrapper: MemoryRouter,
  });

describe('AlertFormSourceItem with several sources', () => {
  beforeEach(() => {
    mockSetFieldValue.mockClear();
  });

  it('keeps the destinations when a source is added', () => {
    renderItem();
    fireEvent.click(screen.getByTestId('add-topic'));

    expect(mockSetFieldValue).toHaveBeenCalledWith('input', {});
    expect(mockSetFieldValue).toHaveBeenCalledWith('resources', [
      'table',
      'topic',
    ]);
    expect(mockSetFieldValue).not.toHaveBeenCalledWith('destinations', []);
  });

  it('starts the destinations again when a source is taken away', () => {
    renderItem();
    fireEvent.click(screen.getByTestId('only-topic'));

    expect(mockSetFieldValue).toHaveBeenCalledWith('destinations', []);
    expect(mockSetFieldValue).toHaveBeenCalledWith('resources', ['topic']);
  });
});
