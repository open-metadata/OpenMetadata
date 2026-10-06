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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    onPress,
    'data-testid': testId,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} onClick={onPress}>
      {children}
    </button>
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Documents: () => <svg />,
  GlossaryTerm: () => <svg />,
  Policy: () => <svg />,
}));

const mockSetHash = jest.fn();
let mockSubPath = '';

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'governance', subPath: mockSubPath, params: {} },
    setHash: mockSetHash,
    clearHash: jest.fn(),
    updateParams: jest.fn(),
  }),
}));

jest.mock('./GovernanceLanding', () =>
  jest.fn(() => <div data-testid="governance-landing" />)
);

jest.mock('./GovernanceGlossaryList', () =>
  jest.fn(() => <div data-testid="governance-glossary-list" />)
);

jest.mock('./GovernanceGlossaryFormPage', () =>
  jest.fn(({ editName }: { editName?: string }) => (
    <div
      data-edit-name={editName ?? ''}
      data-testid="governance-glossary-form-page"
    />
  ))
);

jest.mock('./GovernanceIntakeList', () =>
  jest.fn(() => <div data-testid="governance-intake-list" />)
);

jest.mock('./GovernanceIntakeFormPage', () =>
  jest.fn(
    ({ entityType, editId }: { entityType?: string; editId?: string }) => (
      <div
        data-edit-id={editId ?? ''}
        data-entity-type={entityType ?? ''}
        data-testid="governance-intake-form-page"
      />
    )
  )
);

import GovernancePanel from './GovernancePanel';

const mockOnHeaderChange = jest.fn();

const renderPanel = () =>
  render(
    <MemoryRouter>
      <GovernancePanel onHeaderChange={mockOnHeaderChange} />
    </MemoryRouter>
  );

describe('GovernancePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubPath = '';
  });

  it('renders GovernanceLanding for empty subPath', () => {
    renderPanel();

    expect(screen.getByTestId('governance-landing')).toBeInTheDocument();
  });

  it('renders GovernanceGlossaryList for "glossary-relations" subPath', () => {
    mockSubPath = 'glossary-relations';
    renderPanel();

    expect(screen.getByTestId('governance-glossary-list')).toBeInTheDocument();
  });

  it('renders GovernanceGlossaryFormPage (add) for "glossary-relations/add"', () => {
    mockSubPath = 'glossary-relations/add';
    renderPanel();

    expect(
      screen.getByTestId('governance-glossary-form-page')
    ).toBeInTheDocument();
    expect(screen.getByTestId('governance-glossary-form-page')).toHaveAttribute(
      'data-edit-name',
      ''
    );
  });

  it('renders GovernanceGlossaryFormPage (edit) for "glossary-relations/<name>"', () => {
    mockSubPath = 'glossary-relations/broader';
    renderPanel();

    expect(screen.getByTestId('governance-glossary-form-page')).toHaveAttribute(
      'data-edit-name',
      'broader'
    );
  });

  it('renders GovernanceIntakeList for "intake-forms" subPath', () => {
    mockSubPath = 'intake-forms';
    renderPanel();

    expect(screen.getByTestId('governance-intake-list')).toBeInTheDocument();
  });

  it('renders GovernanceIntakeFormPage (add) for "intake-forms/add/<entityType>"', () => {
    mockSubPath = 'intake-forms/add/dataProduct';
    renderPanel();

    expect(screen.getByTestId('governance-intake-form-page')).toHaveAttribute(
      'data-entity-type',
      'dataProduct'
    );
  });

  it('renders GovernanceIntakeFormPage (edit) for "intake-forms/<id>"', () => {
    mockSubPath = 'intake-forms/form-xyz';
    renderPanel();

    expect(screen.getByTestId('governance-intake-form-page')).toHaveAttribute(
      'data-edit-id',
      'form-xyz'
    );
  });

  it('calls onHeaderChange on mount', () => {
    renderPanel();

    expect(mockOnHeaderChange).toHaveBeenCalled();
  });

  it('passes actions=undefined to header on the landing view', () => {
    renderPanel();
    const lastCall =
      mockOnHeaderChange.mock.calls[mockOnHeaderChange.mock.calls.length - 1];

    expect(lastCall[0]).toMatchObject({ actions: undefined });
  });

  it('passes an "Add Relation Type" button as actions for the glossary-list view', () => {
    mockSubPath = 'glossary-relations';
    renderPanel();
    const lastCall =
      mockOnHeaderChange.mock.calls[mockOnHeaderChange.mock.calls.length - 1];

    expect(lastCall[0].actions).toBeTruthy();
  });

  it('clicking the injected "Add Relation Type" button navigates to glossary-add', () => {
    mockSubPath = 'glossary-relations';
    const { unmount } = render(
      <MemoryRouter>
        <GovernancePanel onHeaderChange={mockOnHeaderChange} />
      </MemoryRouter>
    );
    const lastCall =
      mockOnHeaderChange.mock.calls[mockOnHeaderChange.mock.calls.length - 1];
    const actionsElement = lastCall[0].actions as React.ReactElement;
    const { container } = render(actionsElement);
    const btn = container.querySelector('[data-testid="add-relation-type"]');

    expect(btn).toBeTruthy();

    fireEvent.click(btn as HTMLElement);

    expect(mockSetHash).toHaveBeenCalledWith(
      'governance',
      'glossary-relations/add'
    );

    unmount();
  });
});
