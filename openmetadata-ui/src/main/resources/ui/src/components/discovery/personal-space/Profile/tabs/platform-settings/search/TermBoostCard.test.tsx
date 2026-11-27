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
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import tagClassBase from '../../../../../../../utils/TagClassBase';
import { showErrorToast } from '../../../../../../../utils/ToastUtils';
import TermBoostCard, { getTermBoostField } from './TermBoostCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: { getTags: jest.fn() },
}));

const tag = (fullyQualifiedName: string) => ({
  data: { fullyQualifiedName },
});

describe('TermBoostCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tagClassBase.getTags as jest.Mock).mockResolvedValue({
      data: [tag('Tier.Tier1'), tag('PII.Sensitive')],
    });
  });

  it.each([
    ['Tier.Tier1', 'tier.tagFQN'],
    ['Certification.Gold', 'certification.tagLabel.tagFQN'],
    ['PII.Sensitive', 'tags.tagFQN'],
  ])('indexes %s under %s', (tagFqn, field) => {
    expect(getTermBoostField(tagFqn)).toBe(field);
  });

  it('reports a picked tag with the field it is indexed under', async () => {
    const onChange = jest.fn();
    render(<TermBoostCard onChange={onChange} onDelete={jest.fn()} />);

    await waitFor(() =>
      expect(tagClassBase.getTags).toHaveBeenCalledWith('', 1, true)
    );

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(async () => {
      await user.click(screen.getByRole('combobox'));
    });
    await act(async () => {
      await user.keyboard('{ArrowDown}{Enter}');
    });

    expect(onChange).toHaveBeenLastCalledWith({
      field: 'tier.tagFQN',
      value: 'Tier.Tier1',
      boost: 0,
    });
  });

  it('locks the tag of a saved boost and reports boost changes', async () => {
    const onChange = jest.fn();
    const onDelete = jest.fn();
    render(
      <TermBoostCard
        termBoost={{ field: 'tags.tagFQN', value: 'PII.Sensitive', boost: 2 }}
        onChange={onChange}
        onDelete={onDelete}
      />
    );

    expect(
      await screen.findByTestId('autocomplete-selected-item')
    ).toHaveTextContent('PII.Sensitive');
    expect(tagClassBase.getTags).not.toHaveBeenCalled();
    expect(screen.getByTestId('term-boost-value')).toHaveTextContent('2');

    act(() => {
      fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    });

    expect(onChange).toHaveBeenLastCalledWith({
      field: 'tags.tagFQN',
      value: 'PII.Sensitive',
      boost: 2.1,
    });

    fireEvent.click(screen.getByTestId('delete-term-boost'));

    expect(onDelete).toHaveBeenCalledWith('PII.Sensitive');
  });

  it('toasts when the tags cannot be loaded', async () => {
    (tagClassBase.getTags as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<TermBoostCard onChange={jest.fn()} onDelete={jest.fn()} />);

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });
});
