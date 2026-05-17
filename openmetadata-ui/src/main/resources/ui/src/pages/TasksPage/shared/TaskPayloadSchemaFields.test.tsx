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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { JsonSchemaObject } from '../../../rest/taskFormSchemasAPI';
import TaskPayloadSchemaFields from './TaskPayloadSchemaFields';

jest.mock('./DescriptionTabs', () => ({
  DescriptionTabs: jest
    .fn()
    .mockImplementation(({ onChange, suggestion, value }) => (
      <button
        data-testid="description-tabs"
        onClick={() => onChange(`${value}:${suggestion}:updated`)}>
        description-tabs
      </button>
    )),
}));

jest.mock('./TagsTabs', () => ({
  TagsTabs: jest.fn().mockImplementation(({ onChange }) => (
    <button
      data-testid="tags-tabs"
      onClick={() =>
        onChange([
          {
            labelType: 'Manual',
            source: TagSource.Classification,
            state: 'Confirmed',
            tagFQN: 'Classification.PersonalData.Personal',
          },
          {
            labelType: 'Manual',
            source: TagSource.Classification,
            state: 'Confirmed',
            tagFQN: 'PII.Sensitive',
          },
        ])
      }>
      tags-tabs
    </button>
  )),
}));

jest.mock('./TagSuggestion', () =>
  jest.fn().mockImplementation(({ onChange }) => (
    <button
      data-testid="tag-selector"
      onClick={() =>
        onChange([
          {
            labelType: 'Manual',
            source: TagSource.Classification,
            state: 'Confirmed',
            tagFQN: 'Tier.Tier1',
          },
        ])
      }>
      tag-selector
    </button>
  ))
);

const PERSONAL_TAG: TagLabel = {
  labelType: 'Manual',
  source: TagSource.Classification,
  state: 'Confirmed',
  tagFQN: 'Classification.PersonalData.Personal',
};

const CONFIDENTIAL_TAG: TagLabel = {
  labelType: 'Manual',
  source: TagSource.Classification,
  state: 'Confirmed',
  tagFQN: 'Classification.PersonalData.Confidential',
};

describe('TaskPayloadSchemaFields', () => {
  it('updates description payload fields through the schema widget', () => {
    const onChange = jest.fn();
    const schema: JsonSchemaObject = {
      type: 'object',
      properties: {
        fieldPath: { title: 'Field Path', type: 'string' },
        currentDescription: { title: 'Current Description', type: 'string' },
        newDescription: { title: 'New Description', type: 'string' },
      },
    };
    const uiSchema: JsonSchemaObject = {
      'ui:order': ['newDescription', 'fieldPath', 'currentDescription'],
      fieldPath: { 'ui:widget': 'hidden' },
      currentDescription: { 'ui:widget': 'hidden' },
      newDescription: { 'ui:widget': 'descriptionTabs' },
    };

    render(
      <TaskPayloadSchemaFields
        payload={{
          currentDescription: 'current',
          fieldPath: 'columns.address.description',
          newDescription: 'suggested',
        }}
        schema={schema}
        uiSchema={uiSchema}
        onChange={onChange}
      />
    );

    expect(screen.queryByText('Field Path:')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('description-tabs'));

    expect(onChange).toHaveBeenCalledWith({
      currentDescription: 'current',
      fieldPath: 'columns.address.description',
      newDescription: 'current:suggested:updated',
    });
  });

  it('derives tagsToAdd and tagsToRemove from the tags widget', () => {
    const onChange = jest.fn();
    const schema: JsonSchemaObject = {
      type: 'object',
      properties: {
        currentTags: { title: 'Current Tags', type: 'array' },
        tagsToAdd: { title: 'Tags To Add', type: 'array' },
        tagsToRemove: { title: 'Tags To Remove', type: 'array' },
      },
    };
    const uiSchema: JsonSchemaObject = {
      'ui:order': ['tagsToAdd', 'currentTags', 'tagsToRemove'],
      currentTags: { 'ui:widget': 'hidden' },
      tagsToRemove: { 'ui:widget': 'hidden' },
      tagsToAdd: { 'ui:widget': 'tagsTabs' },
    };

    render(
      <TaskPayloadSchemaFields
        payload={{
          currentTags: [PERSONAL_TAG, CONFIDENTIAL_TAG],
          tagsToAdd: [],
          tagsToRemove: [],
        }}
        schema={schema}
        uiSchema={uiSchema}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('tags-tabs'));

    expect(onChange).toHaveBeenCalledWith({
      currentTags: [PERSONAL_TAG, CONFIDENTIAL_TAG],
      tagsToAdd: [
        {
          labelType: 'Manual',
          source: TagSource.Classification,
          state: 'Confirmed',
          tagFQN: 'PII.Sensitive',
        },
      ],
      tagsToRemove: [CONFIDENTIAL_TAG],
    });
  });

  it('renders standard controls from the schema and updates payload values', () => {
    const onChange = jest.fn();
    const schema: JsonSchemaObject = {
      type: 'object',
      properties: {
        reviewNotes: { title: 'Review Notes', type: 'string' },
        confidence: { title: 'Confidence', type: 'number' },
        assigneeNotes: { title: 'Assignee Notes', type: 'string' },
      },
    };
    const uiSchema: JsonSchemaObject = {
      'ui:order': ['reviewNotes', 'confidence', 'assigneeNotes'],
      assigneeNotes: { 'ui:widget': 'textarea' },
    };

    render(
      <TaskPayloadSchemaFields
        payload={{
          assigneeNotes: '',
          confidence: 0,
          reviewNotes: '',
        }}
        schema={schema}
        uiSchema={uiSchema}
        onChange={onChange}
      />
    );

    const [reviewNotesInput, assigneeNotesInput] =
      screen.getAllByRole('textbox');
    fireEvent.change(reviewNotesInput, { target: { value: 'Looks good' } });
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '87' },
    });
    fireEvent.change(assigneeNotesInput, {
      target: { value: 'Needs changes' },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, {
      assigneeNotes: '',
      confidence: 0,
      reviewNotes: 'Looks good',
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      assigneeNotes: '',
      confidence: 87,
      reviewNotes: '',
    });
    expect(onChange).toHaveBeenNthCalledWith(3, {
      assigneeNotes: 'Needs changes',
      confidence: 0,
      reviewNotes: '',
    });
  });

  it('renders boolean fields from the schema and updates the payload', () => {
    const onChange = jest.fn();
    const schema: JsonSchemaObject = {
      type: 'object',
      properties: {
        approved: {
          title: 'Approved',
          type: 'boolean',
          default: false,
        },
      },
    };

    render(
      <TaskPayloadSchemaFields
        payload={{}}
        schema={schema}
        uiSchema={{}}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith({
      approved: true,
    });
  });

  it('renders read-only schema values without invoking change handlers', () => {
    const onChange = jest.fn();
    const schema: JsonSchemaObject = {
      type: 'object',
      properties: {
        reviewNotes: { title: 'Review Notes', type: 'string' },
        tagsToAdd: { title: 'Suggested Tags', type: 'array' },
      },
    };

    render(
      <TaskPayloadSchemaFields
        mode="read"
        payload={{
          reviewNotes: 'Reviewed and approved',
          tagsToAdd: [PERSONAL_TAG],
        }}
        schema={schema}
        uiSchema={{ tagsToAdd: { 'ui:widget': 'tagSelector' } }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Reviewed and approved')).toBeInTheDocument();
    expect(screen.getByText(PERSONAL_TAG.tagFQN)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports editing object payload fields through JSON text areas', () => {
    const onChange = jest.fn();
    const schema: JsonSchemaObject = {
      type: 'object',
      properties: {
        metadataChange: { title: 'Metadata Change', type: 'object' },
      },
    };

    render(
      <TaskPayloadSchemaFields
        payload={{
          metadataChange: { path: 'description', value: 'old' },
        }}
        schema={schema}
        uiSchema={{}}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '{"path":"description","value":"new"}' },
    });

    expect(onChange).toHaveBeenCalledWith({
      metadataChange: { path: 'description', value: 'new' },
    });
  });
});
