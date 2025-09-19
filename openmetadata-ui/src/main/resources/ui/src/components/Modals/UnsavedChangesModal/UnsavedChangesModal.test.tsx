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
import { UnsavedChangesModal } from './UnsavedChangesModal.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'message.unsaved-changes': 'Unsaved changes',
        'message.unsaved-changes-description':
          'Do you want to save or discard changes?',
        'message.unsaved-changes-discard': 'Discard',
        'message.unsaved-changes-save': 'Save changes',
      };

      return translations[key] || key;
    },
  }),
}));

const mockProps = {
  open: true,
  onDiscard: jest.fn(),
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

describe('UnsavedChangesModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with default props', () => {
    render(<UnsavedChangesModal {...mockProps} />);

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(
      screen.getByText('Do you want to save or discard changes?')
    ).toBeInTheDocument();
    expect(screen.getByText('Discard')).toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('should render with custom props', () => {
    const customProps = {
      ...mockProps,
      title: 'Custom Title',
      description: 'Custom Description',
      discardText: 'Custom Discard',
      saveText: 'Custom Save',
    };

    render(<UnsavedChangesModal {...customProps} />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();
    expect(screen.getByText('Custom Discard')).toBeInTheDocument();
    expect(screen.getByText('Custom Save')).toBeInTheDocument();
  });

  it('should call onDiscard when discard button is clicked', () => {
    render(<UnsavedChangesModal {...mockProps} />);

    fireEvent.click(screen.getByText('Discard'));

    expect(mockProps.onDiscard).toHaveBeenCalledTimes(1);
  });

  it('should call onSave when save button is clicked', () => {
    render(<UnsavedChangesModal {...mockProps} />);

    fireEvent.click(screen.getByText('Save changes'));

    expect(mockProps.onSave).toHaveBeenCalledTimes(1);
  });

  it('should show loading state on save button', () => {
    render(<UnsavedChangesModal {...mockProps} loading />);

    const saveButton = screen.getByText('Save changes');

    expect(saveButton.closest('.ant-btn')).toHaveClass('ant-btn-loading');
  });

  it('should not render when open is false', () => {
    render(<UnsavedChangesModal {...mockProps} open={false} />);

    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
});
