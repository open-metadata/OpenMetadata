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
import { isValidElement, ReactNode } from 'react';
import AnnouncementsNotificationSection from './AnnouncementsNotificationSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../hooks/platform/useSystemAnnouncements', () => ({
  useSystemAnnouncementsList: () => ({ announcements: [] }),
}));

jest.mock('../SystemAnnouncementsTable/SystemAnnouncementsTable', () => ({
  __esModule: true,
  default: ({
    onDuplicate,
    onEdit,
  }: {
    onDuplicate: (a: { id: string }) => void;
    onEdit: (a: { id: string }) => void;
  }) => (
    <div data-testid="table">
      <button onClick={() => onEdit({ id: 'a1' })}>edit</button>
      <button onClick={() => onDuplicate({ id: 'a1' })}>duplicate</button>
    </div>
  ),
}));

jest.mock(
  '../SystemAnnouncementFormLoader/SystemAnnouncementFormLoader',
  () => ({
    __esModule: true,
    default: ({
      id,
      mode,
      onSaved,
    }: {
      id?: string;
      mode: string;
      onSaved: () => void;
    }) => (
      <button data-testid="form" onClick={onSaved}>{`${mode}:${
        id ?? ''
      }`}</button>
    ),
  })
);

const setup = (subPath?: string) => {
  const props = {
    subPath,
    onNavigate: jest.fn(),
    onSetHeaderActions: jest.fn(),
    onSetSubTitle: jest.fn(),
  };

  return { props, ...render(<AnnouncementsNotificationSection {...props} />) };
};

const lastHeaderAction = (mock: jest.Mock): ReactNode =>
  mock.mock.calls[mock.mock.calls.length - 1][0];

describe('AnnouncementsNotificationSection', () => {
  it('shows the list at the root, with Add in the panel header', () => {
    const { props } = setup();

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(props.onSetSubTitle).toHaveBeenLastCalledWith(null);

    const action = lastHeaderAction(props.onSetHeaderActions);

    expect(isValidElement(action)).toBe(true);

    render(<>{action}</>);
    fireEvent.click(screen.getByTestId('add-announcement'));

    expect(props.onNavigate).toHaveBeenCalledWith('add');
  });

  it('routes row actions to their sub-pages', () => {
    const { props } = setup();

    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByText('duplicate'));

    expect(props.onNavigate).toHaveBeenNthCalledWith(1, 'edit/a1');
    expect(props.onNavigate).toHaveBeenNthCalledWith(2, 'duplicate/a1');
  });

  it.each([
    ['add', 'create:', 'label.add-entity'],
    ['edit/a1', 'edit:a1', 'label.edit-entity'],
    ['duplicate/a1', 'duplicate:a1', 'label.add-entity'],
  ])(
    'opens the form for %s and names the sub-page',
    async (subPath, form, subTitle) => {
      const { props } = setup(subPath);

      expect(await screen.findByTestId('form')).toHaveTextContent(form);
      expect(props.onSetSubTitle).toHaveBeenLastCalledWith(subTitle);
      expect(props.onSetHeaderActions).toHaveBeenLastCalledWith(null);
    }
  );

  it('returns to the list once the form saves', async () => {
    const { props } = setup('add');

    fireEvent.click(await screen.findByTestId('form'));

    expect(props.onNavigate).toHaveBeenCalledWith();
  });

  it('clears what it pushed into the panel header when it unmounts', () => {
    const { props, unmount } = setup();

    unmount();

    expect(props.onSetHeaderActions).toHaveBeenLastCalledWith(null);
    expect(props.onSetSubTitle).toHaveBeenLastCalledWith(null);
  });
});
