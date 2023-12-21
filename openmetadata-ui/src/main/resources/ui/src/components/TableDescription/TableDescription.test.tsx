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
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../enums/entity.enum';
import TableDescription from './TableDescription.component';

jest.mock('../../pages/TasksPage/EntityTasks/EntityTasks.component', () => {
  return jest.fn().mockReturnValue(<p>EntityTasks</p>);
});

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewer',
  () => {
    return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
  }
);

describe('TableDescription Component', () => {
  const mockProps = {
    index: 0,
    columnData: {
      fqn: 'testEntity',
      field: 'Test description',
    },
    entityFqn: 'testEntity',
    isReadOnly: false,
    onClick: jest.fn(),
    entityType: EntityType.TABLE,
    hasEditPermission: true,
    onThreadLinkSelect: jest.fn(),
  };

  it('should render description correctly', () => {
    const { getByTestId } = render(<TableDescription {...mockProps} />);
    const descriptionElement = getByTestId('description');

    expect(descriptionElement).toBeInTheDocument();
    expect(descriptionElement).toHaveTextContent(
      'RichTextEditorPreviewerEntityTasks'
    );
  });

  it('should render edit button when hasEditPermission is true', () => {
    const { getByTestId } = render(<TableDescription {...mockProps} />);
    const editButton = getByTestId('edit-button');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(mockProps.onClick).toHaveBeenCalled();
  });

  it('should not render edit button when hasEditPermission is false', () => {
    const { queryByTestId } = render(
      <TableDescription {...mockProps} hasEditPermission={false} />
    );
    const editButton = queryByTestId('edit-button');

    expect(editButton).toBeNull();
  });

  it('should call onClick prop when Edit Button is clicked', () => {
    const onClick = jest.fn();
    render(<TableDescription {...mockProps} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('edit-button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
