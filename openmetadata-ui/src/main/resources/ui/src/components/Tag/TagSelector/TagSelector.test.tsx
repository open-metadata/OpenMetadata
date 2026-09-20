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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import {
  LabelType,
  State,
  TagSource,
} from '../../../generated/type/tagLabel';
import tagClassBase from '../../../utils/TagClassBase';
import TagSelector from './TagSelector';

// Capture FilterSelect props for assertion
let capturedFilterSelectProps: Record<string, unknown> = {};

jest.mock('@openmetadata/ui-core-components', () => ({
  FilterSelect: jest.fn((props: Record<string, unknown>) => {
    capturedFilterSelectProps = props;

    return <div data-testid="filter-select" />;
  }),
  FormItemLabel: jest.fn(({ label }: { label: React.ReactNode }) => (
    // eslint-disable-next-line jsx-a11y/label-has-for -- test mock
    <label data-testid="form-item-label">{label}</label>
  )),
}));

jest.mock('@openmetadata/ui-core-components/icon', () => ({
  Icon: jest.fn(() => <span data-testid="icon" />),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Tag: jest.fn(() => <span data-testid="tag-icon" />),
}));

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  // Pass-through debounce so search calls fire synchronously in tests
  debounce: (fn: (...args: unknown[]) => unknown) =>
    Object.assign(fn, { cancel: jest.fn() }),
}));

const mockGetTags = jest.fn().mockResolvedValue({
  data: [
    {
      label: 'Personal.Email',
      value: 'Personal.Email',
      data: { name: 'Email', displayName: 'Email Tag', style: { color: '#f00' } },
    },
  ],
});

jest.mock('../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: { getTags: jest.fn() },
}));

const makeTag = (fqn: string) => ({
  tagFQN: fqn,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
});

describe('TagSelector', () => {
  beforeEach(() => {
    capturedFilterSelectProps = {};
    (tagClassBase.getTags as jest.Mock).mockImplementation(mockGetTags);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders FilterSelect', async () => {
    await act(async () => {
      render(<TagSelector value={[]} onChange={jest.fn()} />);
    });

    expect(screen.getByTestId('filter-select')).toBeInTheDocument();
  });

  it('calls getTags with empty string on mount to pre-populate options', async () => {
    await act(async () => {
      render(<TagSelector value={[]} onChange={jest.fn()} />);
    });

    expect(tagClassBase.getTags).toHaveBeenCalledWith('', 1);
  });

  it('does not render FormItemLabel when label prop is undefined', async () => {
    await act(async () => {
      render(<TagSelector value={[]} onChange={jest.fn()} />);
    });

    expect(screen.queryByTestId('form-item-label')).not.toBeInTheDocument();
  });

  it('renders FormItemLabel when label prop is provided', async () => {
    await act(async () => {
      render(<TagSelector label="Tags" value={[]} onChange={jest.fn()} />);
    });

    expect(screen.getByTestId('form-item-label')).toBeInTheDocument();
    expect(screen.getByTestId('form-item-label')).toHaveTextContent('Tags');
  });

  it('passes selectedValues as FQN strings to FilterSelect', async () => {
    const tags = [makeTag('Personal.Email'), makeTag('Personal.SSN')];

    await act(async () => {
      render(<TagSelector value={tags} onChange={jest.fn()} />);
    });

    expect(capturedFilterSelectProps.selectedValues).toEqual([
      'Personal.Email',
      'Personal.SSN',
    ]);
  });

  it('calls onChange with TagLabel built from cache on selection', async () => {
    const onChange = jest.fn();

    await act(async () => {
      render(<TagSelector value={[]} onChange={onChange} />);
    });

    // Simulate the FilterSelect calling onChange with an FQN that was cached during fetch
    await act(async () => {
      (capturedFilterSelectProps.onChange as (fqns: string[]) => void)([
        'Personal.Email',
      ]);
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        tagFQN: 'Personal.Email',
        source: TagSource.Classification,
        name: 'Email',
        displayName: 'Email Tag',
      }),
    ]);
  });

  it('falls back to buildTagLabelFromFqn when FQN is not in cache', async () => {
    const onChange = jest.fn();

    await act(async () => {
      render(<TagSelector value={[]} onChange={onChange} />);
    });

    await act(async () => {
      (capturedFilterSelectProps.onChange as (fqns: string[]) => void)([
        'Unknown.Tag',
      ]);
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        tagFQN: 'Unknown.Tag',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      }),
    ]);
  });

  it('resolveMissingLabel returns displayName from cache', async () => {
    await act(async () => {
      render(<TagSelector value={[]} onChange={jest.fn()} />);
    });

    const resolve = capturedFilterSelectProps.resolveMissingLabel as (
      fqn: string
    ) => string;

    expect(resolve('Personal.Email')).toBe('Email Tag');
  });

  it('resolveMissingLabel falls back to fqn when not in cache', async () => {
    await act(async () => {
      render(<TagSelector value={[]} onChange={jest.fn()} />);
    });

    const resolve = capturedFilterSelectProps.resolveMissingLabel as (
      fqn: string
    ) => string;

    expect(resolve('Not.Cached')).toBe('Not.Cached');
  });

  it('calls onSearch with debounced search text', async () => {
    await act(async () => {
      render(<TagSelector value={[]} onChange={jest.fn()} />);
    });

    await act(async () => {
      (capturedFilterSelectProps.onSearch as (text: string) => void)('email');
    });

    expect(tagClassBase.getTags).toHaveBeenCalledWith('email', 1);
  });
});
