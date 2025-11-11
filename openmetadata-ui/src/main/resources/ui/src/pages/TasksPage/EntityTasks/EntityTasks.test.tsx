/*
 *  Copyright 2023 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { TagSource } from '../../../generated/type/tagLabel';
import EntityTasks from './EntityTasks.component';
import { EntityTasksProps } from './EntityTasks.interface';

const mockRequestTags = {
  pathname: '/request-tags/table/sample_data.ecommerce_db.shopify.fact_sale',
  search: 'field=columns&value=sale_id',
};

const mockUpdateTags = {
  pathname: '/update-tags/table/sample_data.ecommerce_db.shopify.fact_sale',
  search: 'field=columns&value=sale_id',
};

const mockRequestDescription = {
  pathname:
    '/request-description/table/sample_data.ecommerce_db.shopify.fact_sale',
  search: 'field=columns&value=sale_id',
};

const mockUpdateDescription = {
  pathname:
    '/update-description/table/sample_data.ecommerce_db.shopify.fact_sale',
  search: 'field=columns&value=sale_id',
};

const mockProps: EntityTasksProps = {
  data: {
    fqn: 'sample_data.ecommerce_db.shopify.fact_session',
    field: 'this is test',
  },
  tagSource: TagSource.Classification,
  entityFqn: '',
  entityType: EntityType.TABLE,
  entityTaskType: EntityField.TAGS,
  onThreadLinkSelect: jest.fn(),
};

jest.mock('../../../utils/TasksUtils', () => ({
  getEntityTaskDetails: jest.fn().mockReturnValue({
    fqnPart: FqnPart.NestedColumn,
    entityField: EntityField.COLUMNS,
  }),
  getRequestDescriptionPath: jest
    .fn()
    .mockImplementation(() => mockRequestDescription),
  getRequestTagsPath: jest.fn().mockImplementation(() => mockRequestTags),
  getUpdateDescriptionPath: jest
    .fn()
    .mockImplementation(() => mockUpdateDescription),
  getUpdateTagsPath: jest.fn().mockImplementation(() => mockUpdateTags),
}));

jest.mock('../../../utils/FeedElementUtils', () => ({
  getFieldThreadElement: jest
    .fn()
    .mockImplementation(() => (
      <p data-testid="list-conversation">List Conversation</p>
    )),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getPartialNameFromTableFQN: jest.fn().mockReturnValue('test'),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

describe('Entity Task component', () => {
  it('Should render the component', async () => {
    render(<EntityTasks {...mockProps} />);

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();
  });

  it('Task Element should be visible when tagSource is not glossary', async () => {
    render(<EntityTasks {...mockProps} />);

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();

    const taskElement = screen.queryByTestId('task-element');

    expect(taskElement).toBeInTheDocument();
  });

  it('Task Element should not visible when tagSource is glossary', async () => {
    render(<EntityTasks {...mockProps} tagSource={TagSource.Glossary} />);

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();

    const taskElement = screen.queryByTestId('task-element');

    expect(taskElement).not.toBeInTheDocument();
  });

  it('List conversation should be there in component', async () => {
    render(<EntityTasks {...mockProps} tagSource={TagSource.Glossary} />);

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();

    const conversation = await screen.findByTestId('list-conversation');

    expect(conversation).toBeInTheDocument();
  });

  it('Handle update tags click', async () => {
    render(<EntityTasks {...mockProps} />);

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();

    const taskElement = await screen.findByTestId('task-element');

    expect(taskElement).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(taskElement);
    });

    expect(mockNavigate).toHaveBeenCalledWith(mockUpdateTags);
  });

  it('Handle request tags click', async () => {
    render(
      <EntityTasks
        {...mockProps}
        data={{
          fqn: 'sample_data.ecommerce_db.shopify.fact_session',
        }}
      />
    );

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();

    const taskElement = await screen.findByTestId('task-element');

    expect(taskElement).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(taskElement);
    });

    expect(mockNavigate).toHaveBeenCalledWith(mockRequestTags);
  });

  it('Handle update description click', async () => {
    render(
      <EntityTasks {...mockProps} entityTaskType={EntityField.DESCRIPTION} />
    );

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();

    const taskElement = await screen.findByTestId('task-element');

    expect(taskElement).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(taskElement);
    });

    expect(mockNavigate).toHaveBeenCalledWith(mockUpdateDescription);
  });

  it('Handle request description click', async () => {
    render(
      <EntityTasks
        {...mockProps}
        data={{
          fqn: 'sample_data.ecommerce_db.shopify.fact_session',
        }}
        entityTaskType={EntityField.DESCRIPTION}
      />
    );

    const container = await screen.findByTestId('entity-task');

    expect(container).toBeInTheDocument();

    const taskElement = await screen.findByTestId('task-element');

    expect(taskElement).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(taskElement);
    });

    expect(mockNavigate).toHaveBeenCalledWith(mockRequestDescription);
  });
});
