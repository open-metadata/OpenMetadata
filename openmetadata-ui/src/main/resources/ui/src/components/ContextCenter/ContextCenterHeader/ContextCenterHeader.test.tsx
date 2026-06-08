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
import { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import ContextCenterHeader from './ContextCenterHeader.component';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => jest.fn()),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Breadcrumbs: jest.fn(() => <nav data-testid="title-breadcrumb" />),
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  Card: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockBreadcrumbs: BreadcrumbItemType[] = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'context-center', label: 'Context Center', href: '/context-center' },
];

describe('ContextCenterHeader', () => {
  it('renders the header with title', () => {
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
      />
    );

    expect(screen.getByTestId('context-center-header')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Center')).toBeInTheDocument();
  });

  it('renders the breadcrumb', () => {
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
      />
    );

    expect(screen.getByTestId('title-breadcrumb')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        subtitle="Manage your knowledge resources"
        title="Knowledge Center"
      />
    );

    expect(
      screen.getByText('Manage your knowledge resources')
    ).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
      />
    );

    expect(
      screen.queryByText('Manage your knowledge resources')
    ).not.toBeInTheDocument();
  });

  it('renders the create article button when onCreateArticle is provided', () => {
    const onCreateArticle = jest.fn();
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
        onCreateArticle={onCreateArticle}
      />
    );

    expect(screen.getByText(/create-entity/i)).toBeInTheDocument();
  });

  it('does not render the create article button when onCreateArticle is not provided', () => {
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
      />
    );

    expect(screen.queryByText(/create-entity/i)).not.toBeInTheDocument();
  });

  it('calls onCreateArticle when the create article button is clicked', () => {
    const onCreateArticle = jest.fn();
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
        onCreateArticle={onCreateArticle}
      />
    );

    fireEvent.click(screen.getByText(/create-entity/i));

    expect(onCreateArticle).toHaveBeenCalled();
  });

  it('renders the upload file button when onUploadFile is provided', () => {
    const onUploadFile = jest.fn();
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
        onUploadFile={onUploadFile}
      />
    );

    expect(screen.getByText(/upload-file/i)).toBeInTheDocument();
  });

  it('calls onUploadFile when the upload button is clicked', () => {
    const onUploadFile = jest.fn();
    render(
      <ContextCenterHeader
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
        onUploadFile={onUploadFile}
      />
    );

    fireEvent.click(screen.getByText(/upload-file/i));

    expect(onUploadFile).toHaveBeenCalled();
  });

  it('renders actionsSlot instead of default buttons when provided', () => {
    render(
      <ContextCenterHeader
        actionsSlot={<div data-testid="custom-slot">Custom Actions</div>}
        breadcrumbs={mockBreadcrumbs}
        title="Knowledge Center"
        onCreateArticle={jest.fn()}
        onUploadFile={jest.fn()}
      />
    );

    expect(screen.getByTestId('custom-slot')).toBeInTheDocument();
    expect(screen.queryByText(/create-entity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/upload-file/i)).not.toBeInTheDocument();
  });
});
