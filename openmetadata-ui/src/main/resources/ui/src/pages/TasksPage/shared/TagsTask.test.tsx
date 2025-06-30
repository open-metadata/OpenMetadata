/*
 *  Copyright 2024 Collate.
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
import {
  TaskType,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { TASK_FEED } from '../../../mocks/Task.mock';
import TagsTask from './TagsTask';

jest.mock('./TagSuggestion', () =>
  jest.fn().mockImplementation(({ onChange }) => (
    <div>
      <p>TagSuggestion</p>
      <button onClick={onChange}>TagSuggestionButton</button>
    </div>
  ))
);

jest.mock('./TagsDiffView', () => ({
  TagsDiffView: jest.fn().mockReturnValue(<p>TagsDiffView</p>),
}));

jest.mock('./TagsTabs', () => ({
  TagsTabs: jest.fn().mockImplementation(({ onChange }) => (
    <div>
      <p>TagsTabs</p>
      <button onClick={onChange}>TagsTabsButton</button>
    </div>
  )),
}));

const mockProps = {
  task: TASK_FEED.task,
  isTaskActionEdit: false,
  hasEditAccess: false,
  onChange: jest.fn(),
};

const mockTask = {
  id: 2,
  type: TaskType.RequestTag,
  assignees: [
    {
      id: '31d072f8-7873-4976-88ea-ac0d2f51f632',
      type: 'team',
      name: 'Sales',
      fullyQualifiedName: 'Sales',
      deleted: false,
    },
  ],
};

describe('Test TagsTask Component', () => {
  it('Should render the component', async () => {
    render(<TagsTask {...mockProps} />);

    expect(screen.getByTestId('task-tags-tabs')).toBeInTheDocument();
  });

  it('Should render TagsDiffView component if in not editMode, type is RequestTag and not having hasEditAccess', async () => {
    render(<TagsTask {...mockProps} />);

    expect(screen.getByTestId('tags-task')).toBeInTheDocument();
    expect(screen.getByTestId('request-tags')).toBeInTheDocument();

    expect(screen.getByText('TagsDiffView')).toBeInTheDocument();
  });

  // eslint-disable-next-line max-len
  it('Should render TagsDiffView component if in not editMode, type is RequestTag, not having hasEditAccess and if suggestion tags is present', async () => {
    render(
      <TagsTask
        {...mockProps}
        task={{
          ...mockTask,
          suggestion:
            // eslint-disable-next-line max-len
            '[{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","name":"SpecialCategory","description":"GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination."}]',
        }}
      />
    );

    expect(screen.getByTestId('tags-task')).toBeInTheDocument();
    expect(screen.getByTestId('request-tags')).toBeInTheDocument();

    expect(screen.getByText('TagsDiffView')).toBeInTheDocument();
  });

  // eslint-disable-next-line max-len
  it('Should render TagsDiffView component if in not editMode, type is RequestTag, not having hasEditAccess and if old tags is present', async () => {
    render(
      <TagsTask
        {...mockProps}
        task={{
          ...mockTask,
          oldValue:
            // eslint-disable-next-line max-len
            '[{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","name":"SpecialCategory","description":"GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination."}]',
        }}
      />
    );

    expect(screen.getByTestId('tags-task')).toBeInTheDocument();
    expect(screen.getByTestId('request-tags')).toBeInTheDocument();

    expect(screen.getByText('TagsDiffView')).toBeInTheDocument();
  });

  // eslint-disable-next-line max-len
  it('Should render noDataPlaceholder if in not editMode, type is RequestTag, not having hasEditAccess and do not have old and suggestion', async () => {
    render(<TagsTask {...mockProps} task={mockTask} />);

    expect(screen.getByTestId('tags-task')).toBeInTheDocument();
    expect(screen.getByTestId('request-tags')).toBeInTheDocument();

    expect(screen.getByTestId('no-suggestion')).toBeInTheDocument();
  });

  it('Should render TagsDiffView if not in editMode, type is RequestTag and having hasEditAccess', async () => {
    render(<TagsTask {...mockProps} hasEditAccess />);

    expect(screen.getByTestId('tags-task')).toBeInTheDocument();
    expect(screen.getByTestId('request-tags')).toBeInTheDocument();

    expect(screen.getByText('TagsDiffView')).toBeInTheDocument();
  });

  it('Should render TagSuggestion and call onChange if in editMode, type is RequestTag and having hasEditAccess', async () => {
    render(<TagsTask {...mockProps} hasEditAccess isTaskActionEdit />);

    expect(screen.getByTestId('tags-task')).toBeInTheDocument();
    expect(screen.getByTestId('request-tags')).toBeInTheDocument();

    expect(screen.getByText('TagSuggestion')).toBeInTheDocument();

    fireEvent.click(screen.getByText('TagSuggestionButton'));

    expect(mockProps.onChange).toHaveBeenCalled();
  });

  it('Should render no-suggestion if not in editMode, type is UpdateTag and not having hasEditAccess', async () => {
    render(
      <TagsTask
        {...mockProps}
        task={{ ...mockTask, type: TaskType.UpdateTag }}
      />
    );

    expect(screen.getByTestId('update-tags')).toBeInTheDocument();

    expect(screen.getByTestId('no-suggestion')).toBeInTheDocument();
  });

  it('Should render TagsTabs and call onChange if in editMode, type is UpdateTag and not having hasEditAccess', async () => {
    render(
      <TagsTask
        {...mockProps}
        hasEditAccess
        isTaskActionEdit
        task={{ ...mockTask, type: TaskType.UpdateTag }}
      />
    );

    expect(screen.getByTestId('update-tags')).toBeInTheDocument();

    expect(screen.getByText('TagsTabs')).toBeInTheDocument();

    fireEvent.click(screen.getByText('TagsTabsButton'));

    expect(mockProps.onChange).toHaveBeenCalled();
  });

  it('Should render noDataPlaceholder if task is closed and no new and old value is there', async () => {
    render(
      <TagsTask
        {...mockProps}
        task={{ ...mockTask, status: ThreadTaskStatus.Closed }}
      />
    );

    expect(screen.getByText('label.no-entity')).toBeInTheDocument();
  });

  it('Should render TagsDiffView if task is closed and no new and old value is there', async () => {
    render(
      <TagsTask
        {...mockProps}
        task={{
          ...mockTask,
          status: ThreadTaskStatus.Closed,
          oldValue:
            // eslint-disable-next-line max-len
            '[{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","name":"SpecialCategory","description":"GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination."}]',
        }}
      />
    );

    expect(screen.getByText('TagsDiffView')).toBeInTheDocument();
  });
});
