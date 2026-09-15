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

function TagForm({
  fetchOptions,
  initialOptions = [personal],
}: Pick<AsyncSelectListProps, 'fetchOptions' | 'initialOptions'>) {
  const [saved, setSaved] = useState<unknown>();

  return (
    <>
      <Form
        initialValues={{ tags: initialOptions.map((option) => option.value) }}
        onFinish={({ tags }: { tags: Array<string | { value: string }> }) =>
          setSaved({
            tags: tags.map((tag) =>
              typeof tag === 'string' ? tag : tag.value
            ),
          })
        }>
        <Form.Item name="tags">
          <AsyncSelectList
            open
            fetchOptions={fetchOptions}
            initialOptions={initialOptions}
            mode="multiple"
            onCancel={() => undefined}
          />
        </Form.Item>
      </Form>
      <output data-testid="saved-tags">{JSON.stringify(saved)}</output>
    </>
  );
}

it('prevents an empty update when there are no existing tags or selectable options', async () => {
  render(
    <TagForm
      fetchOptions={async () => ({ data: [], paging: { total: 0 } })}
      initialOptions={[]}
    />
  );
  const save = await screen.findByTestId('saveAssociatedTag');

  expect(save).toBeDisabled();

  userEvent.click(save);

  expect(screen.getByTestId('saved-tags')).toBeEmptyDOMElement();
});

it.each([
  ['pending', 'existing'],
  ['empty', 'existing'],
  ['pending', 'new'],
  ['empty', 'new'],
] as const)(
  'submits after a %s search with the %s selection',
  async (searchState, selection) => {
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
        initialOptions={selection === 'existing' ? [personal] : []}
      />
    );
    const option = await screen.findByTestId(`tag-${personal.value}`);
    if (selection === 'new') {
      userEvent.click(option);
      await screen.findByTestId(`selected-tag-${personal.value}`);
    }
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
    await waitFor(() => {
      const saved = JSON.parse(
        screen.getByTestId('saved-tags').textContent || '{}'
      );

      expect(saved.tags).toEqual([personal.value]);
    });
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
