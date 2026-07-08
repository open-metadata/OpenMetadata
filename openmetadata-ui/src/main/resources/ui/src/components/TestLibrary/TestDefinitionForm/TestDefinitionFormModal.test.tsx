/*
 *  Copyright 2025 Collate.
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
import TestDefinitionFormModal from './TestDefinitionFormModal';

describe('TestDefinitionFormModal', () => {
  const onClose = jest.fn();
  const onSubmit = jest.fn();

  it('renders title, children and footer when open', () => {
    render(
      <TestDefinitionFormModal
        open
        title="Add Test Definition"
        onClose={onClose}
        onSubmit={onSubmit}>
        <div data-testid="modal-child" />
      </TestDefinitionFormModal>
    );

    expect(screen.getByText('Add Test Definition')).toBeInTheDocument();
    expect(screen.getByTestId('modal-child')).toBeInTheDocument();
    expect(screen.getByTestId('create-btn')).toBeInTheDocument();
  });

  it('fires onSubmit and onClose from the footer buttons', () => {
    render(
      <TestDefinitionFormModal
        open
        title="Add"
        onClose={onClose}
        onSubmit={onSubmit}>
        <div />
      </TestDefinitionFormModal>
    );
    fireEvent.click(screen.getByTestId('create-btn'));

    expect(onSubmit).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cancel-btn'));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not render the dialog content when closed', () => {
    render(
      <TestDefinitionFormModal
        open={false}
        title="Add"
        onClose={onClose}
        onSubmit={onSubmit}>
        <div data-testid="modal-child" />
      </TestDefinitionFormModal>
    );

    expect(screen.queryByTestId('modal-child')).not.toBeInTheDocument();
    expect(screen.queryByTestId('create-btn')).not.toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(
      <TestDefinitionFormModal
        open
        subtitle="Configure your test definition"
        title="Add"
        onClose={onClose}
        onSubmit={onSubmit}>
        <div />
      </TestDefinitionFormModal>
    );

    expect(
      screen.getByText('Configure your test definition')
    ).toBeInTheDocument();
  });

  it('uses a custom submit label when provided', () => {
    render(
      <TestDefinitionFormModal
        open
        submitLabel="Update"
        title="Edit"
        onClose={onClose}
        onSubmit={onSubmit}>
        <div />
      </TestDefinitionFormModal>
    );

    expect(screen.getByTestId('create-btn')).toHaveTextContent('Update');
  });

  it('shows a loading state on the submit button while submitting', () => {
    render(
      <TestDefinitionFormModal
        isSubmitting
        open
        title="Add"
        onClose={onClose}
        onSubmit={onSubmit}>
        <div />
      </TestDefinitionFormModal>
    );

    expect(screen.getByTestId('create-btn')).toHaveAttribute(
      'data-loading',
      'true'
    );
  });
});
