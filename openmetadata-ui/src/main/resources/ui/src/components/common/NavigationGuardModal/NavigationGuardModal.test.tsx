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
import { NavigationGuardModal } from './NavigationGuardModal';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({ t: (key: string) => key }),
}));

describe('NavigationGuardModal', () => {
  const onLeave = jest.fn();
  const onStay = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render content when closed', () => {
    render(
      <NavigationGuardModal isOpen={false} onLeave={onLeave} onStay={onStay} />
    );

    expect(
      screen.queryByText('message.unsaved-changes')
    ).not.toBeInTheDocument();
  });

  it('should render header, description and both actions when open', async () => {
    render(<NavigationGuardModal isOpen onLeave={onLeave} onStay={onStay} />);

    expect(
      await screen.findByText('message.unsaved-changes')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.unsaved-changes-description')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.discard' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.continue-editing' })
    ).toBeInTheDocument();
  });

  it('should call onLeave when Discard is clicked', async () => {
    render(<NavigationGuardModal isOpen onLeave={onLeave} onStay={onStay} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'label.discard' })
    );

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onStay).not.toHaveBeenCalled();
  });

  it('should call onStay when Continue Editing is clicked', async () => {
    render(<NavigationGuardModal isOpen onLeave={onLeave} onStay={onStay} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'label.continue-editing' })
    );

    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });
});
