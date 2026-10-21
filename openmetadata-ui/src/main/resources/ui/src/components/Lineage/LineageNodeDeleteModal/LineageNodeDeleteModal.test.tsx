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
import LineageNodeDeleteModal from './LineageNodeDeleteModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LineageNodeDeleteModal', () => {
  const props = {
    isOpen: true,
    isDeleting: false,
    nodeName: 'orders',
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders nothing when closed', () => {
    render(<LineageNodeDeleteModal {...props} isOpen={false} />);

    expect(
      screen.queryByTestId('delete-node-confirmation-modal')
    ).not.toBeInTheDocument();
  });

  it('confirms and cancels', () => {
    render(<LineageNodeDeleteModal {...props} />);
    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables confirm while deleting', () => {
    render(<LineageNodeDeleteModal {...props} isDeleting />);

    expect(screen.getByTestId('confirm-button')).toBeDisabled();
  });
});
