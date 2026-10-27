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

import {
    act,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import RemoveFromTeamButton from './RemoveFromTeamButton';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

const renderButton = (onConfirm: () => Promise<boolean>) =>
  render(
    <RemoveFromTeamButton
      childName="Alice"
      data-testid="remove-user-alice"
      parentName="Engineering"
      onConfirm={onConfirm}
    />
  );

const openPopover = () =>
  fireEvent.click(screen.getByTestId('remove-user-alice'));

describe('RemoveFromTeamButton', () => {
  it('asks to remove the child from the parent', () => {
    renderButton(jest.fn().mockResolvedValue(true));
    openPopover();

    expect(
      screen.getByTestId('remove-from-team-popover-title')
    ).toHaveTextContent('label.remove-entity{"entity":"Alice"}');
    expect(
      screen.getByTestId('remove-from-team-popover-description')
    ).toHaveTextContent('"child":"Alice","parent":"Engineering"');
    expect(
      screen.getByTestId('remove-from-team-popover-confirm')
    ).toHaveTextContent('label.remove');
  });

  it('runs the removal and closes on success', async () => {
    const onConfirm = jest.fn().mockResolvedValue(true);
    renderButton(onConfirm);
    openPopover();

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-from-team-popover-confirm'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(
        screen.queryByTestId('remove-from-team-popover')
      ).not.toBeInTheDocument()
    );
  });

  it('stays open when the removal fails so the user can retry', async () => {
    const onConfirm = jest.fn().mockResolvedValue(false);
    renderButton(onConfirm);
    openPopover();

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-from-team-popover-confirm'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('remove-from-team-popover')).toBeInTheDocument();
  });

  it('does not remove when cancelled', async () => {
    const onConfirm = jest.fn();
    renderButton(onConfirm);
    openPopover();

    fireEvent.click(screen.getByTestId('remove-from-team-popover-cancel'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('remove-from-team-popover')
      ).not.toBeInTheDocument()
    );

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
