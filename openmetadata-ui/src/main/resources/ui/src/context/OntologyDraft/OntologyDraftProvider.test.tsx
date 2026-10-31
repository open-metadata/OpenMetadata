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
import { Button, Input } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useContext, useState } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  useOntologyDirtyForm,
  useOntologyDraftGuard,
  useOntologyDraftLock,
} from '../../hooks/governance/ontology/useOntologyDraftGuard';
import { OntologyDraftContext } from './OntologyDraftContext';
import OntologyDraftProvider from './OntologyDraftProvider';

const Editor = ({ locked = false }: { locked?: boolean }) => {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState('Customer');
  const guard = useOntologyDraftGuard();
  const markSaved = useOntologyDirtyForm(Boolean(draft));
  useOntologyDraftLock(locked);

  return (
    <>
      <Input aria-label="Description" value={draft} onChange={setDraft} />
      <Button
        onPress={() =>
          guard(() => {
            setSelected('Person');
            setDraft('');
          })
        }>
        Select person
      </Button>
      <Button
        onPress={() => {
          markSaved();
          setDraft('');
        }}>
        Save
      </Button>
      <output>{selected}</output>
    </>
  );
};

it('keeps edits on cancel and changes selection only after discard', () => {
  render(
    <MemoryRouter>
      <OntologyDraftProvider>
        <Editor />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
    target: { value: 'Unsaved description' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Select person' }));

  expect(screen.getByRole('dialog')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

  expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
    'Unsaved description'
  );
  expect(screen.getByText('Customer')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Select person' }));
  fireEvent.click(screen.getByRole('button', { name: 'label.discard' }));

  expect(screen.getByText('Person')).toBeInTheDocument();
});

it('does not ask to discard after a successful save', () => {
  render(
    <MemoryRouter>
      <OntologyDraftProvider>
        <Editor />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
    target: { value: 'Saved description' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select person' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('Person')).toBeInTheDocument();
});

it('cannot discard a pending attempt until its outcome is reconciled', () => {
  const view = (locked: boolean) => (
    <MemoryRouter>
      <OntologyDraftProvider>
        <Editor locked={locked} />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  const { rerender } = render(view(true));
  fireEvent.click(screen.getByRole('button', { name: 'Select person' }));

  expect(
    screen.getByText('message.ontology-class-attempt-pending')
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'label.discard' })).toBeDisabled();

  rerender(view(false));
  fireEvent.click(screen.getByRole('button', { name: 'label.discard' }));

  expect(screen.getByText('Person')).toBeInTheDocument();
});

const RouteEditor = () => {
  const location = useLocation();

  return (
    <>
      <Editor />
      <output data-testid="route">{location.pathname + location.search}</output>
    </>
  );
};

const SidebarNavigation = ({ replace }: { replace: boolean }) => {
  const navigate = useNavigate();

  return (
    <Button
      onPress={() =>
        navigate('/explore?tab=all#results', {
          replace,
          state: { source: 'sidebar' },
        })
      }>
      Explore
    </Button>
  );
};

it.each([false, true])(
  'guards sidebar navigation and preserves replace=%s after confirmation',
  async (replace) => {
    window.history.replaceState({ idx: 1 }, '', '/governance/ontology');
    const view = render(
      <BrowserRouter>
        <SidebarNavigation replace={replace} />
        <Routes>
          <Route
            element={
              <OntologyDraftProvider>
                <Editor />
              </OntologyDraftProvider>
            }
            path="/governance/ontology"
          />
          <Route
            element={<output>Explore destination</output>}
            path="/explore"
          />
        </Routes>
      </BrowserRouter>
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'Keep this draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.cancel' })
    );

    expect(window.location.pathname).toBe('/governance/ontology');
    expect(screen.getByDisplayValue('Keep this draft')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    fireEvent.click(screen.getByRole('button', { name: 'label.discard' }));

    expect(await screen.findByText('Explore destination')).toBeVisible();
    expect(
      window.location.pathname + window.location.search + window.location.hash
    ).toBe('/explore?tab=all#results');
    expect(window.history.state).toMatchObject({
      idx: replace ? 1 : 2,
      usr: { source: 'sidebar' },
    });

    view.unmount();
  }
);

it('keeps an uncertain attempt mounted when a sidebar button navigates', () => {
  const view = (locked: boolean) => (
    <MemoryRouter>
      <SidebarNavigation replace={false} />
      <OntologyDraftProvider>
        <Editor locked={locked} />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  const { rerender } = render(view(true));
  fireEvent.click(screen.getByRole('button', { name: 'Explore' }));

  expect(screen.getByRole('button', { name: 'label.discard' })).toBeDisabled();
  expect(
    screen.getByRole('textbox', { name: 'Description', hidden: true })
  ).toBeInTheDocument();

  rerender(view(false));

  expect(screen.getByRole('button', { name: 'label.discard' })).toBeEnabled();
});

it('allows navigation immediately after a successful save clears the dirty registration', () => {
  const SavedEditor = () => {
    const markSaved = useOntologyDirtyForm(true);
    const navigate = useNavigate();

    return (
      <Button
        onPress={() => {
          markSaved();
          navigate('/explore');
        }}>
        Save and leave
      </Button>
    );
  };
  render(
    <MemoryRouter>
      <OntologyDraftProvider>
        <SavedEditor />
        <RouteEditor />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save and leave' }));

  expect(screen.getByTestId('route')).toHaveTextContent('/explore');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('commits an acknowledged selection while retaining the attempt lock for unrelated navigation', () => {
  const CompletedAttempt = () => {
    const { runConfirmed } = useContext(OntologyDraftContext);
    const navigate = useNavigate();
    const location = useLocation();

    return (
      <>
        <Editor locked />
        <Button
          onPress={() =>
            runConfirmed(() => navigate('?concept=created', { replace: true }))
          }>
          Select created class
        </Button>
        <output>{location.search}</output>
      </>
    );
  };
  render(
    <MemoryRouter>
      <SidebarNavigation replace={false} />
      <OntologyDraftProvider>
        <CompletedAttempt />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Select created class' }));

  expect(screen.getByText('?concept=created')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Explore' }));

  expect(screen.getByRole('button', { name: 'label.discard' })).toBeDisabled();
});

const NestedEditor = () => {
  const [open, setOpen] = useState(true);
  const guard = useOntologyDraftGuard();

  return (
    <>
      <Editor />
      {open && (
        <Button onPress={() => guard(() => setOpen(false))}>
          Close nested editor
        </Button>
      )}
    </>
  );
};

it('keeps guarding an editor that remains mounted after another surface closes', () => {
  render(
    <MemoryRouter>
      <OntologyDraftProvider>
        <NestedEditor />
      </OntologyDraftProvider>
    </MemoryRouter>
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
    target: { value: 'Still unsaved' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close nested editor' }));
  fireEvent.click(screen.getByRole('button', { name: 'label.discard' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select person' }));

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Still unsaved')).toBeInTheDocument();
});

it('preserves edits and history when browser Back changes ontology query parameters', async () => {
  window.history.replaceState(
    { idx: 0 },
    '',
    '/governance/ontology?ontology=first'
  );
  window.history.pushState(
    { idx: 1 },
    '',
    '/governance/ontology?ontology=second'
  );
  const view = render(
    <BrowserRouter>
      <OntologyDraftProvider>
        <RouteEditor />
      </OntologyDraftProvider>
    </BrowserRouter>
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
    target: { value: 'Keep this draft' },
  });
  act(() => window.history.back());
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
  await waitFor(() => expect(window.location.search).toBe('?ontology=second'));

  expect(screen.getByTestId('route')).toHaveTextContent('?ontology=second');
  expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
    'Keep this draft'
  );

  act(() => window.history.back());
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'label.discard' }));
  await waitFor(() =>
    expect(screen.getByTestId('route')).toHaveTextContent('?ontology=first')
  );
  view.unmount();
});
