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
import { Form } from 'antd';
import { useState } from 'react';
import AsyncSelectList from './AsyncSelectList';
import { AsyncSelectListProps } from './AsyncSelectList.interface';

const personal = {
  label: 'PersonalData.Personal',
  value: 'PersonalData.Personal',
};

function TagForm({ fetchOptions }: Pick<AsyncSelectListProps, 'fetchOptions'>) {
  const [saved, setSaved] = useState<unknown>();

  return (
    <>
      <Form initialValues={{ tags: [personal.value] }} onFinish={setSaved}>
        <Form.Item name="tags">
          <AsyncSelectList
            open
            fetchOptions={fetchOptions}
            initialOptions={[personal]}
            mode="multiple"
            onCancel={() => undefined}
          />
        </Form.Item>
      </Form>
      <output data-testid="saved-tags">{JSON.stringify(saved)}</output>
    </>
  );
}

it.each(['pending', 'empty'] as const)(
  'submits the selected tag when a later search is %s',
  async (searchState) => {
    let finishSearch: (() => void) | undefined;
    render(
      <TagForm
        fetchOptions={async (search) => {
          if (!search) {
            return { data: [personal], paging: { total: 1 } };
          }

          await new Promise<void>((resolve) => {
            finishSearch = resolve;
          });

          return { data: [], paging: { total: 0 } };
        }}
      />
    );
    await screen.findByTestId(`tag-${personal.value}`);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'no-matching-tags' },
    });
    await waitFor(() => expect(finishSearch).toBeDefined(), { timeout: 2000 });
    if (searchState === 'empty') {
      await act(async () => finishSearch?.());
    }

    const save = screen.getByTestId('saveAssociatedTag');

    expect(save).toBeEnabled();

    userEvent.click(save);
    await waitFor(() =>
      expect(screen.getByTestId('saved-tags')).toHaveTextContent(
        JSON.stringify({ tags: [personal.value] })
      )
    );
    await act(async () => finishSearch?.());
  }
);

it('submits removal of the last selected tag even when no options are available', async () => {
  render(
    <TagForm fetchOptions={async () => ({ data: [], paging: { total: 0 } })} />
  );
  userEvent.click(await screen.findByTestId('remove-tags'));
  await waitFor(() =>
    expect(
      screen.queryByTestId(`selected-tag-${personal.value}`)
    ).not.toBeInTheDocument()
  );
  const save = screen.getByTestId('saveAssociatedTag');

  expect(save).toBeEnabled();

  userEvent.click(save);
  await waitFor(() =>
    expect(screen.getByTestId('saved-tags')).toHaveTextContent('{"tags":[]}')
  );
});
