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

import { TreeSelectNode } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import {
  LabelType,
  State,
  TagSource,
} from '../../../generated/entity/data/container';
import { TagLabel } from '../../../generated/type/tagLabel';
import ClassificationTagPicker from './ClassificationTagPicker';

const mockFetchData = jest.fn();
let capturedTreeSelectProps: Record<string, unknown> = {};

jest.mock('./hooks/useClassificationTreeData', () => ({
  useClassificationTreeData: jest.fn(() => mockFetchData),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  TreeSelect: jest.fn((props: Record<string, unknown>) => {
    capturedTreeSelectProps = props;

    return <div data-testid="tree-select" />;
  }),
}));

const makeClassificationTag = (
  fqn: string,
  overrides?: Partial<TagLabel>
): TagLabel => ({
  tagFQN: fqn,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
  name: fqn.split('.').pop(),
  displayName: fqn.split('.').pop(),
  ...overrides,
});

const makeGlossaryTag = (fqn: string): TagLabel => ({
  tagFQN: fqn,
  source: TagSource.Glossary,
  labelType: LabelType.Manual,
  state: State.Confirmed,
});

describe('ClassificationTagPicker', () => {
  beforeEach(() => {
    capturedTreeSelectProps = {};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders TreeSelect', () => {
    render(<ClassificationTagPicker value={[]} onChange={jest.fn()} />);

    expect(screen.getByTestId('tree-select')).toBeInTheDocument();
  });

  it('passes fetchData from useClassificationTreeData to TreeSelect', () => {
    render(<ClassificationTagPicker value={[]} onChange={jest.fn()} />);

    expect(capturedTreeSelectProps.fetchData).toBe(mockFetchData);
  });

  it('only passes Classification-source tags as selectedValue', () => {
    const tags = [
      makeClassificationTag('Personal.Email'),
      makeGlossaryTag('Glossary.Term'),
    ];

    render(<ClassificationTagPicker value={tags} onChange={jest.fn()} />);

    const selected =
      capturedTreeSelectProps.value as TreeSelectNode<TagLabel>[];

    expect(selected).toHaveLength(1);
    expect(selected[0].value).toBe('Personal.Email');
  });

  it('maps TagLabel fields to TreeSelectNode shape', () => {
    const tag = makeClassificationTag('Personal.Email');

    render(<ClassificationTagPicker value={[tag]} onChange={jest.fn()} />);

    const selected =
      capturedTreeSelectProps.value as TreeSelectNode<TagLabel>[];

    expect(selected[0]).toMatchObject({
      id: 'Personal.Email',
      value: 'Personal.Email',
      label: 'Email',
      isLeaf: true,
      data: tag,
    });
  });

  it('uses tagFQN as label fallback when displayName and name are absent', () => {
    const tag: TagLabel = {
      tagFQN: 'Personal.Email',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    };

    render(<ClassificationTagPicker value={[tag]} onChange={jest.fn()} />);

    const selected =
      capturedTreeSelectProps.value as TreeSelectNode<TagLabel>[];

    expect(selected[0].label).toBe('Personal.Email');
  });

  it('onChange preserves server-managed fields from original value', () => {
    const originalTag = makeClassificationTag('Personal.Email', {
      appliedBy: 'user@example.com',
    } as Partial<TagLabel>);
    const onChange = jest.fn();

    render(
      <ClassificationTagPicker value={[originalTag]} onChange={onChange} />
    );

    const handleChange = capturedTreeSelectProps.onChange as (
      nodes: TreeSelectNode<TagLabel>[]
    ) => void;

    handleChange([
      {
        id: 'Personal.Email',
        value: 'Personal.Email',
        label: 'Email',
        data: makeClassificationTag('Personal.Email'),
        isLeaf: true,
      },
    ]);

    expect(onChange).toHaveBeenCalledWith([originalTag]);
  });

  it('onChange falls back to node.data for newly selected tags not in value', () => {
    const newTag = makeClassificationTag('Personal.SSN');
    const onChange = jest.fn();

    render(<ClassificationTagPicker value={[]} onChange={onChange} />);

    const handleChange = capturedTreeSelectProps.onChange as (
      nodes: TreeSelectNode<TagLabel>[]
    ) => void;

    handleChange([
      {
        id: 'Personal.SSN',
        value: 'Personal.SSN',
        label: 'SSN',
        data: newTag,
        isLeaf: true,
      },
    ]);

    expect(onChange).toHaveBeenCalledWith([newTag]);
  });

  it('onChange with null produces empty array', () => {
    const onChange = jest.fn();

    render(<ClassificationTagPicker value={[]} onChange={onChange} />);

    (capturedTreeSelectProps.onChange as (nodes: null) => void)(null);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('forwards label, required and data-testid props to TreeSelect', () => {
    render(
      <ClassificationTagPicker
        required
        data-testid="tag-picker"
        label="Tags"
        value={[]}
        onChange={jest.fn()}
      />
    );

    expect(capturedTreeSelectProps.label).toBe('Tags');
    expect(capturedTreeSelectProps.required).toBe(true);
    expect(capturedTreeSelectProps['data-testid']).toBe('tag-picker');
  });

  it('defaults multiple to true', () => {
    render(<ClassificationTagPicker value={[]} onChange={jest.fn()} />);

    expect(capturedTreeSelectProps.multiple).toBe(true);
  });
});
