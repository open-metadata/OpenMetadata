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
import { CheckType } from '../../../generated/entity/governance/onboardingPlaybook';
import { buildFieldOptions } from '../../../utils/governance/playbooks/Playbook.utils';
import { PlaybookAddCheck } from './PlaybookAddCheck';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const options = buildFieldOptions(
  ['description', 'tags', 'owners'],
  [
    {
      name: 'retentionPolicy',
      description: 'Retention policy',
      propertyType: { id: 'p', type: 'type', name: 'enum' },
    },
  ]
);

const renderPopover = (captured: string[] = []) => {
  const onAdd = jest.fn();
  const onNewCustomProperty = jest.fn();
  render(
    <PlaybookAddCheck
      capturedFieldPaths={new Set(captured)}
      options={options}
      onAdd={onAdd}
      onNewCustomProperty={onNewCustomProperty}
    />
  );
  fireEvent.click(screen.getByTestId('add-check'));

  return { onAdd, onNewCustomProperty };
};

describe('PlaybookAddCheck', () => {
  it('offers the asset fields, its custom properties and a sign-off', async () => {
    renderPopover();

    expect(await screen.findByTestId('add-field-description')).toBeVisible();
    expect(
      screen.getByTestId('add-field-extension.retentionPolicy')
    ).toBeVisible();
    expect(screen.getByTestId('add-field-approval')).toBeVisible();
  });

  it('adds the check the picked field asks for', async () => {
    const { onAdd } = renderPopover();

    fireEvent.click(await screen.findByTestId('add-field-description'));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldPath: 'description',
        type: CheckType.Attribute,
      })
    );
  });

  it('does not offer a field another gate already captures', async () => {
    renderPopover(['description']);

    expect(await screen.findByTestId('add-field-tags')).toBeVisible();
    expect(screen.queryByTestId('add-field-description')).toBeNull();
  });

  it('keeps offering the sign-off, which is not a field and is never captured', async () => {
    renderPopover([
      'description',
      'tags',
      'owners',
      'extension.retentionPolicy',
    ]);

    expect(await screen.findByTestId('add-field-approval')).toBeVisible();
  });

  it('searches on the field name as well as the title', async () => {
    renderPopover();

    fireEvent.change(await screen.findByTestId('check-search'), {
      target: { value: 'retention' },
    });

    expect(
      screen.getByTestId('add-field-extension.retentionPolicy')
    ).toBeVisible();
    expect(screen.queryByTestId('add-field-description')).toBeNull();
  });

  it('explains that a field is only ever asked for once when nothing matches', async () => {
    renderPopover();

    fireEvent.change(await screen.findByTestId('check-search'), {
      target: { value: 'nothing-like-this' },
    });

    expect(screen.getByTestId('no-fields-left')).toHaveTextContent(
      'message.every-other-field-is-already-captured'
    );
  });

  it('hands off to the custom-property settings instead of inventing one here', async () => {
    const { onNewCustomProperty } = renderPopover();

    fireEvent.click(await screen.findByTestId('new-custom-property'));

    expect(onNewCustomProperty).toHaveBeenCalled();
  });
});
