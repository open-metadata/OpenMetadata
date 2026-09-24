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
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import GlossaryTermPicker from './GlossaryTermPicker';

const mockTreeSelect = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => ({
  TreeSelect: (props: Record<string, unknown>) => {
    mockTreeSelect(props);

    return <div data-testid="tree-select" />;
  },
}));

const mockFetchTree = jest.fn();

jest.mock('./useGlossaryTreeData', () => ({
  useGlossaryTreeData: () => mockFetchTree,
}));

const APPLIED_TERM: TagLabel = {
  tagFQN: 'Finance.MRR',
  name: 'MRR',
  displayName: 'Monthly Recurring Revenue',
  source: TagSource.Glossary,
  labelType: LabelType.Automated,
  state: State.Suggested,
  appliedBy: 'admin',
};

const CLASSIFICATION_TAG: TagLabel = {
  tagFQN: 'PII.Sensitive',
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
};

const lastProps = () =>
  mockTreeSelect.mock.calls[mockTreeSelect.mock.calls.length - 1][0];

const emit = (
  nodes: TreeSelectNode<unknown>[] | TreeSelectNode<unknown> | null
) => lastProps().onChange(nodes);

describe('GlossaryTermPicker', () => {
  beforeEach(() => {
    mockTreeSelect.mockClear();
  });

  it('keeps an empty glossary selectable when glossaries are the value', async () => {
    mockFetchTree.mockResolvedValue({
      nodes: [
        {
          id: 'Empty',
          label: 'Empty',
          value: 'Empty',
          allowSelection: false,
          data: { isGlossaryRoot: true },
        },
      ],
    });
    render(<GlossaryTermPicker selectGlossaries />);

    const { nodes } = await lastProps().fetchData({});

    expect(nodes[0].allowSelection).toBe(true);
  });

  it('leaves an empty glossary unselectable when terms are the value', async () => {
    mockFetchTree.mockResolvedValue({
      nodes: [
        {
          id: 'Empty',
          label: 'Empty',
          value: 'Empty',
          allowSelection: false,
          data: { isGlossaryRoot: true },
        },
      ],
    });
    render(<GlossaryTermPicker />);

    const { nodes } = await lastProps().fetchData({});

    expect(nodes[0].allowSelection).toBe(false);
  });

  // ChangeParent picks a term: a glossary row is expand-only there, so a click
  // on one could only ever clear the pick.
  it('makes glossary roots unselectable in a single-select term picker', async () => {
    mockFetchTree.mockResolvedValue({
      nodes: [
        {
          id: 'Filled',
          label: 'Filled',
          value: 'Filled',
          allowSelection: true,
          data: { isGlossaryRoot: true },
        },
      ],
    });
    render(<GlossaryTermPicker multiple={false} />);

    const { nodes } = await lastProps().fetchData({});

    expect(nodes[0].allowSelection).toBe(false);
  });

  it('seeds the tree with the glossary labels only', () => {
    render(<GlossaryTermPicker value={[APPLIED_TERM, CLASSIFICATION_TAG]} />);

    expect(screen.getByTestId('tree-select')).toBeInTheDocument();
    expect(lastProps().value).toEqual([
      {
        id: 'Finance.MRR',
        label: 'Monthly Recurring Revenue',
        value: 'Finance.MRR',
        parentId: 'Finance',
        data: APPLIED_TERM,
      },
    ]);
  });

  it('preserves server-managed fields on a term that is already applied', () => {
    const onChange = jest.fn();
    render(<GlossaryTermPicker value={[APPLIED_TERM]} onChange={onChange} />);

    // The node rebuilt from the glossary listing carries none of them.
    emit([
      {
        id: 'Finance.MRR',
        label: 'Monthly Recurring Revenue',
        value: 'Finance.MRR',
        data: {
          tagFQN: 'Finance.MRR',
          name: 'MRR',
          source: TagSource.Glossary,
        },
      },
    ]);

    expect(onChange).toHaveBeenCalledWith([APPLIED_TERM], expect.anything());
  });

  it('reports a newly picked term from its node data', () => {
    const onChange = jest.fn();
    const newTerm = {
      tagFQN: 'Finance.ARR',
      name: 'ARR',
      source: TagSource.Glossary,
    };
    render(<GlossaryTermPicker value={[]} onChange={onChange} />);

    emit([
      {
        id: 'Finance.ARR',
        label: 'ARR',
        value: 'Finance.ARR',
        data: newTerm,
      },
    ]);

    expect(onChange).toHaveBeenCalledWith([newTerm], expect.anything());
  });

  // A stray UI-only field makes the server reject the whole PATCH.
  it('keeps the picker-only fields out of the reported tag', () => {
    const onChange = jest.fn();
    render(<GlossaryTermPicker value={[]} onChange={onChange} />);

    emit([
      {
        id: 'Finance.ARR',
        label: 'ARR',
        value: 'Finance.ARR',
        data: {
          tagFQN: 'Finance.ARR',
          name: 'ARR',
          source: TagSource.Glossary,
          entity: { id: 'uuid-1', name: 'ARR' },
          isGlossaryRoot: false,
        },
      },
    ]);

    const [tags, nodes] = onChange.mock.calls[0];

    expect(tags).toEqual([
      { tagFQN: 'Finance.ARR', name: 'ARR', source: TagSource.Glossary },
    ]);
    expect(tags[0]).not.toHaveProperty('entity');
    expect(tags[0]).not.toHaveProperty('isGlossaryRoot');
    // The entity stays available to callers that resolve ids from it.
    expect(nodes[0].entity).toEqual({ id: 'uuid-1', name: 'ARR' });
  });

  it('drops glossary rows, which are containers rather than terms', () => {
    const onChange = jest.fn();
    render(<GlossaryTermPicker value={[]} onChange={onChange} />);

    emit([
      {
        id: 'Finance',
        label: 'Finance',
        value: 'Finance',
        allowSelection: false,
        data: { tagFQN: 'Finance', source: TagSource.Glossary },
      },
    ]);

    expect(onChange).toHaveBeenCalledWith([], expect.anything());
  });

  it('normalises a single-select pick into an array', () => {
    const onChange = jest.fn();
    const term = {
      tagFQN: 'Finance.ARR',
      name: 'ARR',
      source: TagSource.Glossary,
    };
    render(
      <GlossaryTermPicker multiple={false} value={[]} onChange={onChange} />
    );

    emit({
      id: 'Finance.ARR',
      label: 'ARR',
      value: 'Finance.ARR',
      data: term,
    });

    expect(onChange).toHaveBeenCalledWith([term], expect.anything());
    expect(lastProps().multiple).toBe(false);
  });

  it('reports an empty selection when the tree clears', () => {
    const onChange = jest.fn();
    render(<GlossaryTermPicker value={[APPLIED_TERM]} onChange={onChange} />);

    emit(null);

    expect(onChange).toHaveBeenCalledWith([], expect.anything());
  });

  // A programmatically opened picker is never clicked, so nothing else focuses it.
  it('forwards autoFocus so an already-open picker can be typed into', () => {
    render(
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the prop under test
      <GlossaryTermPicker autoFocus value={[]} />
    );

    expect(lastProps().autoFocus).toBe(true);
  });

  it('forwards the popover controls to the tree', () => {
    const onOpenChange = jest.fn();
    render(
      <GlossaryTermPicker
        isOpen
        commitMode="staged"
        value={[]}
        onOpenChange={onOpenChange}
      />
    );

    expect(lastProps()).toEqual(
      expect.objectContaining({
        commitMode: 'staged',
        isOpen: true,
        onOpenChange,
      })
    );
  });
});
