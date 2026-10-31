/*
 *  Copyright 2024 Collate.
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
import { useState } from 'react';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
import { useWorkflowMode } from './useWorkflowMode';
import { useWorkflowNavigationBlock } from './useWorkflowNavigationBlock';
const Harness = () => {
  const mode = useWorkflowMode('workflow');
  const location = useLocation();
  const [hasNodeConfigSaved, setHasNodeConfigSaved] = useState(true);
  const save = async () => {
    mode.enterViewMode();
    setHasNodeConfigSaved(false);

    return true;
  };
  const guard = useWorkflowNavigationBlock({
    enabled: mode.isEditMode && hasNodeConfigSaved,
    onSaveWorkflow: save,
  });

  return (
    <>
      <a href="/explore">Leave</a>
      <button onClick={() => void save()}>Save workflow</button>
      <button onClick={() => void guard.onSave()}>Save and leave</button>
      <output data-testid="route">
        {location.pathname + location.search + location.hash}
      </output>
      <output data-testid="modal">{String(guard.showModal)}</output>
    </>
  );
};

it('saves the workflow without opening an unsaved-changes prompt', async () => {
  render(
    <MemoryRouter initialEntries={['/workflow?mode=edit']}>
      <Harness />
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(screen.getByTestId('route')).toHaveTextContent('mode=edit')
  );
  fireEvent.click(screen.getByText('Save workflow'));
  await waitFor(() =>
    expect(screen.getByTestId('route')).toHaveTextContent('mode=view')
  );

  expect(screen.getByTestId('modal')).toHaveTextContent('false');
});

it('saves and navigates to the originally selected destination', async () => {
  render(
    <MemoryRouter initialEntries={['/workflow?mode=edit']}>
      <Harness />
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(screen.getByTestId('route')).toHaveTextContent('mode=edit')
  );
  fireEvent.click(screen.getByText('Leave'));

  expect(screen.getByTestId('modal')).toHaveTextContent('true');

  fireEvent.click(screen.getByText('Save and leave'));
  await waitFor(() =>
    expect(screen.getByTestId('route')).toHaveTextContent('/explore')
  );
});

it.each(['back', 'forward'])(
  'preserves the %s destination and state when saving changes history',
  async (direction) => {
    const destination =
      direction === 'back'
        ? '/workflow?mode=view&source=back#details'
        : '/explore?source=forward#results';
    const savedState = { destination: direction };
    if (direction === 'back') {
      window.history.replaceState({ idx: 0, usr: savedState }, '', destination);
      window.history.pushState({ idx: 1 }, '', '/workflow?mode=edit');
    } else {
      window.history.replaceState({ idx: 0 }, '', '/workflow?mode=edit');
      window.history.pushState({ idx: 1, usr: savedState }, '', destination);
      act(() => window.history.back());
      await waitFor(() => expect(window.location.search).toBe('?mode=edit'));
    }
    const view = render(
      <BrowserRouter>
        <Harness />
      </BrowserRouter>
    );
    act(() => window.history.go(direction === 'back' ? -1 : 1));
    await waitFor(() =>
      expect(screen.getByTestId('modal')).toHaveTextContent('true')
    );
    fireEvent.click(screen.getByText('Save and leave'));
    await waitFor(() =>
      expect(screen.getByTestId('route')).toHaveTextContent(destination)
    );

    expect(window.history.state).toMatchObject({
      idx: direction === 'back' ? 0 : 1,
      usr: savedState,
    });
    expect(screen.getByTestId('modal')).toHaveTextContent('false');

    view.unmount();
  }
);
