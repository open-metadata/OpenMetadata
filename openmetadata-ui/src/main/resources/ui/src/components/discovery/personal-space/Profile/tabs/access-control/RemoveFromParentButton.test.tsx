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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RemoveFromParentButton from './RemoveFromParentButton';

jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, string>) =>
    params ? `${key}:${Object.values(params).join(',')}` : key;

  return { useTranslation: () => ({ t }) };
});

const renderButton = (onRemove: () => Promise<boolean>, isDisabled = false) =>
  render(
    <RemoveFromParentButton
      isDisabled={isDisabled}
      name="DataSteward"
      parentName="OrgPolicy"
      onRemove={onRemove}
    />
  );

describe('RemoveFromParentButton', () => {
  it('asks to remove the child from the parent before calling onRemove', async () => {
    const onRemove = jest.fn().mockResolvedValue(true);
    renderButton(onRemove);

    fireEvent.click(screen.getByTestId('remove-DataSteward'));

    expect(
      await screen.findByTestId('remove-entity-popover-description')
    ).toHaveTextContent(
      'message.are-you-sure-you-want-to-remove-child-from-parent:DataSteward,OrgPolicy'
    );
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('remove-entity-popover-confirm'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('remove-entity-popover')
      ).not.toBeInTheDocument()
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('stays open for a retry when the removal resolves false', async () => {
    const onRemove = jest.fn().mockResolvedValue(false);
    renderButton(onRemove);

    fireEvent.click(screen.getByTestId('remove-DataSteward'));
    fireEvent.click(await screen.findByTestId('remove-entity-popover-confirm'));

    await waitFor(() => expect(onRemove).toHaveBeenCalled());

    expect(screen.getByTestId('remove-entity-popover')).toBeInTheDocument();
  });

  it('disables the trigger when isDisabled is set', () => {
    renderButton(jest.fn(), true);

    expect(screen.getByTestId('remove-DataSteward')).toBeDisabled();
  });
});
