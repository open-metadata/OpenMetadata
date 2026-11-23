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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOURCE_URL_PLACEHOLDERS } from '../../constants/Learning.constants';
import { ResourceType } from '../../generated/entity/learning/learningResource';
import { LearningResource } from '../../rest/learningResourceAPI';
import { LearningResourceForm } from './LearningResourceForm.component';

const getTextbox = (testId: string) =>
  within(screen.getByTestId(testId)).getByRole('textbox');

const pickOption = async (
  user: ReturnType<typeof userEvent.setup>,
  testId: string,
  option: string
) => {
  const field = screen.getByTestId(testId);
  await user.click(
    within(field).queryByRole('button') ?? within(field).getByRole('combobox')
  );
  await user.click(await screen.findByRole('option', { name: option }));
};

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

    expect(document.querySelector('.drawer-title')).toHaveTextContent(
      'label.add-resource'
    );
    expect(screen.getByTestId('save-resource')).toBeInTheDocument();
  });

  it('should show edit title when resource is provided', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} resource={mockResource} />);
    });

    expect(document.querySelector('.drawer-title')).toHaveTextContent(
      'label.edit-resource'
    );
  });

  it('should populate form fields when editing a resource', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} resource={mockResource} />);
    });

    const nameInput = getTextbox('name-input');

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

  it('should show save button', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    expect(screen.getByTestId('save-resource')).toHaveTextContent('label.save');
  });

  it('should render all form fields', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
    expect(screen.getByText('label.type')).toBeInTheDocument();
    expect(screen.getByText('label.category-plural')).toBeInTheDocument();
    expect(screen.getByText('label.context')).toBeInTheDocument();
    expect(screen.getByText('label.source-url')).toBeInTheDocument();
    expect(screen.getByText('label.source-provider')).toBeInTheDocument();
    expect(screen.getByText('label.duration')).toBeInTheDocument();
    expect(screen.getByText('label.status')).toBeInTheDocument();
  });

  it('should disable name field when editing', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} resource={mockResource} />);
    });

    const nameInput = getTextbox('name-input');

    expect(nameInput).toBeDisabled();
  });

  it('should enable name field when creating new', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    const nameInput = getTextbox('name-input');

    expect(nameInput).not.toBeDisabled();
  });

  it('should not render when open is false', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} open={false} />);
    });

    expect(document.querySelector('.drawer-title')).toBeNull();
  });

  it('should call onClose when close icon is clicked', async () => {
    await act(async () => {
      render(<LearningResourceForm {...mockProps} />);
    });

    const closeIcon = screen.getByTestId('drawer-close-icon');

    await act(async () => {
      fireEvent.click(closeIcon as Element);
    });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('should offer Video, Storylane, Link and PDF resource types', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<LearningResourceForm {...mockProps} />);

    await user.click(
      within(screen.getByTestId('resource-type-select')).getByRole('button')
    );

    for (const type of [
      'label.video',
      'label.storylane',
      'label.link',
      'label.pdf',
    ]) {
      expect(
        await screen.findByRole('option', { name: type })
      ).toBeInTheDocument();
    }
  });

  it('should suggest a PDF URL once the PDF type is selected', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<LearningResourceForm {...mockProps} />);

    await pickOption(user, 'resource-type-select', 'label.pdf');

    expect(getTextbox('source-url-input')).toHaveAttribute(
      'placeholder',
      SOURCE_URL_PLACEHOLDERS[ResourceType.PDF]
    );
  });

  it('should create a Link resource pointing at the entered URL', async () => {
    const guideUrl = 'https://sharepoint.example.com/sites/data/guide';
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<LearningResourceForm {...mockProps} />);

    fireEvent.change(getTextbox('name-input'), {
      target: { value: 'DataSeekerGuide' },
    });
    fireEvent.change(getTextbox('description-input'), {
      target: { value: 'Internal guidance for Data Seekers' },
    });
    fireEvent.change(getTextbox('source-url-input'), {
      target: { value: guideUrl },
    });
    await pickOption(user, 'resource-type-select', 'label.link');
    await pickOption(user, 'categories-select', 'Discovery');
    await user.keyboard('{Escape}');
    await pickOption(user, 'contexts-select', 'Domain');
    await user.keyboard('{Escape}');

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-resource'));
    });

    await waitFor(() => {
      expect(mockCreateLearningResource).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DataSeekerGuide',
          resourceType: ResourceType.Link,
          categories: ['Discovery'],
          contexts: [{ pageId: 'domain', componentId: undefined }],
          source: { provider: undefined, url: guideUrl },
        })
      );
    });
  });
});
