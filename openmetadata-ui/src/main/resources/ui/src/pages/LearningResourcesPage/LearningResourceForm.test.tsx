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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { LearningResource } from '../../rest/learningResourceAPI';
import { LearningResourceForm } from './LearningResourceForm.component';

const mockCreateLearningResource = jest.fn();
const mockUpdateLearningResource = jest.fn();

jest.mock('../../rest/learningResourceAPI', () => ({
  createLearningResource: jest
    .fn()
    .mockImplementation((...args) => mockCreateLearningResource(...args)),
  updateLearningResource: jest
    .fn()
    .mockImplementation((...args) => mockUpdateLearningResource(...args)),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../components/common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockImplementation(() => <div data-testid="rich-text-editor" />)
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockResource: LearningResource = {
  id: 'test-id-123',
  name: 'TestResource',
  displayName: 'Test Resource',
  description: 'A test learning resource',
  resourceType: 'Video',
  categories: ['Discovery'],
  difficulty: 'Intro',
  source: {
    url: 'https://example.com/video',
    provider: 'YouTube',
  },
  contexts: [{ pageId: 'glossary' }],
  status: 'Active',
  fullyQualifiedName: 'TestResource',
  version: 0.1,
  updatedAt: Date.now(),
  updatedBy: 'admin',
};

const mockProps = {
  open: true,
  resource: null,
  onClose: jest.fn(),
};

describe('LearningResourceForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form drawer when open', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    expect(document.querySelector('.ant-drawer-title')).toHaveTextContent(
      'label.add-entity'
    );
    expect(screen.getByTestId('save-resource')).toBeInTheDocument();
  });

  it('should show edit title when resource is provided', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} resource={mockResource} />);
    });

    expect(document.querySelector('.ant-drawer-title')).toHaveTextContent(
      'label.edit-entity'
    );
  });

  it('should populate form fields when editing a resource', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} resource={mockResource} />);
    });

    const nameInput = screen.getByPlaceholderText('e.g., Intro_GlossaryBasics');

    expect(nameInput).toHaveValue('TestResource');
  });

  it('should call onClose when cancel button is clicked', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    const cancelBtn = screen.getByText('label.cancel');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('should validate required fields before submission', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    const submitBtn = screen.getByTestId('save-resource');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Form validation should prevent API call
    expect(mockCreateLearningResource).not.toHaveBeenCalled();
  });

  it('should show create button text for new resource', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    expect(screen.getByTestId('save-resource')).toHaveTextContent(
      'label.create'
    );
  });

  it('should show update button text when editing', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} resource={mockResource} />);
    });

    expect(screen.getByTestId('save-resource')).toHaveTextContent(
      'label.update'
    );
  });

  it('should render all form fields', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.display-name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
    expect(screen.getByText('label.type')).toBeInTheDocument();
    expect(screen.getByText('label.category-plural')).toBeInTheDocument();
    expect(screen.getByText('label.difficulty')).toBeInTheDocument();
    expect(screen.getByText('label.source-url')).toBeInTheDocument();
    expect(screen.getByText('label.source-provider')).toBeInTheDocument();
    expect(
      screen.getByText('label.estimated-duration-minutes')
    ).toBeInTheDocument();
    expect(screen.getByText('label.context-plural')).toBeInTheDocument();
    expect(screen.getByText('label.status')).toBeInTheDocument();
  });

  it('should not render when open is false', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} open={false} />);
    });

    expect(document.querySelector('.ant-drawer-title')).toBeNull();
  });
});
