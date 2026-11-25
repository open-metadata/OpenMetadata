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
import { Link, MemoryRouter } from 'react-router-dom';
import { useCloseOnNavigation } from './useCloseOnNavigation';

const Drawer = ({ onClose }: { onClose: () => void }) => {
  useCloseOnNavigation(onClose);

  return (
    <div>
      <Link data-testid="same-page-link" to="/glossary/Commerce">
        Commerce
      </Link>
      <a data-testid="new-tab-link" href="/users/aaron" target="_blank">
        @aaron
      </a>
      <button data-testid="button">Reply</button>
    </div>
  );
};

const renderDrawer = (onClose: () => void) =>
  render(
    <MemoryRouter initialEntries={['/glossary/Commerce']}>
      <Drawer onClose={onClose} />
    </MemoryRouter>
  );

describe('useCloseOnNavigation', () => {
  it('does not close when the drawer opens', () => {
    const onClose = jest.fn();
    renderDrawer(onClose);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes once a link navigates, even to the page already open', () => {
    const onClose = jest.fn();
    renderDrawer(onClose);

    fireEvent.click(screen.getByTestId('same-page-link'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for clicks that do not navigate in the app', () => {
    const onClose = jest.fn();
    renderDrawer(onClose);

    fireEvent.click(screen.getByTestId('same-page-link'), { metaKey: true });
    fireEvent.click(screen.getByTestId('new-tab-link'));
    fireEvent.click(screen.getByTestId('button'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
