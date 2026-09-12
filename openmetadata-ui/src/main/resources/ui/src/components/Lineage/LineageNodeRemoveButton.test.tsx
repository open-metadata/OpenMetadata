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
import LineageNodeRemoveButton from './LineageNodeRemoveButton';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LineageNodeRemoveButton', () => {
  it('exposes an accessible Untitled UI action and removes the node', () => {
    const onRemove = jest.fn();

    render(<LineageNodeRemoveButton onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', { name: 'label.remove' });

    expect(removeButton).toHaveAttribute(
      'data-testid',
      'lineage-node-remove-btn'
    );

    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
