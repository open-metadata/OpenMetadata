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
import { TourSteps } from '@deuex-solutions/react-tour';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Tour from '../../components/AppTour/Tour';
import TourProvider, { useTourProvider } from './TourProvider';

jest.mock('@deuex-solutions/react-tour', () => ({
  ...jest.requireActual('@deuex-solutions/react-tour'),
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(
      ({ lastStepNextButton, onRequestSkip, onRequestClose }) => (
        <>
          <p>ReactTour</p>
          <button onClick={onRequestClose}>Close Request</button>
          <button onClick={onRequestSkip}>Skip Request</button>
          {lastStepNextButton}
        </>
      )
    ),
}));

jest.mock('../../components/Modals/TourEndModal/TourEndModal', () =>
  jest.fn().mockImplementation(({ visible, onSave }) => (
    <>
      {visible ? 'TourEndModal is open' : 'TourEndModal is close'}
      <button onClick={onSave}>OnSave_TourEndModal</button>
    </>
  ))
);

// Uses the *real* TourProvider (not mocked) so the route-driven isTourOpen
// effect is exercised. The Probe reads provider state and offers navigation
// buttons so tests can drive transitions across / and /tour.
const Probe = ({ withTour }: { withTour?: boolean }) => {
  const { isTourOpen, isTourPage } = useTourProvider();
  const navigate = useNavigate();

  return (
    <>
      <span data-testid="probe-isTourOpen">{String(isTourOpen)}</span>
      <span data-testid="probe-isTourPage">{String(isTourPage)}</span>
      {withTour ? <Tour steps={[] as TourSteps[]} /> : null}
      <button data-testid="go-home" onClick={() => navigate('/')}>
        Go Home
      </button>
      <button data-testid="go-tour" onClick={() => navigate('/tour')}>
        Go Tour
      </button>
    </>
  );
};

const tree = (initial = '/tour') => (
  <MemoryRouter initialEntries={[initial]}>
    <TourProvider>
      <Routes>
        <Route element={<Probe withTour />} path="/tour" />
        <Route element={<Probe />} path="/" />
      </Routes>
    </TourProvider>
  </MemoryRouter>
);

describe('TourProvider isTourOpen route lifecycle', () => {
  it('resets isTourOpen to false when navigating away from /tour', async () => {
    render(tree('/tour'));

    expect(screen.getByTestId('probe-isTourPage').textContent).toBe('true');
    expect(screen.getByTestId('probe-isTourOpen').textContent).toBe('true');

    await act(async () => {
      fireEvent.click(screen.getByTestId('go-home'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('probe-isTourOpen').textContent).toBe('false');
    });

    expect(screen.getByTestId('probe-isTourPage').textContent).toBe('false');
  });

  it('sets isTourOpen to true when navigating onto /tour from elsewhere', async () => {
    render(tree('/'));

    expect(screen.getByTestId('probe-isTourOpen').textContent).toBe('false');
    expect(screen.getByTestId('probe-isTourPage').textContent).toBe('false');

    await act(async () => {
      fireEvent.click(screen.getByTestId('go-tour'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('probe-isTourOpen').textContent).toBe('true');
    });

    expect(screen.getByTestId('probe-isTourPage').textContent).toBe('true');
  });

  it('Skip path resets isTourOpen to false after leaving /tour', async () => {
    render(tree('/tour'));

    expect(await screen.findByText('ReactTour')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Skip Request' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('probe-isTourPage').textContent).toBe('false');
    });

    expect(screen.getByTestId('probe-isTourOpen').textContent).toBe('false');
  });

  it('Finish path resets isTourOpen to false after leaving /tour', async () => {
    render(tree('/tour'));

    expect(await screen.findByText('ReactTour')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('last-step-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('OnSave_TourEndModal'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('probe-isTourPage').textContent).toBe('false');
    });

    expect(screen.getByTestId('probe-isTourOpen').textContent).toBe('false');
  });

  it('X-close resets isTourOpen while staying on /tour', async () => {
    render(tree('/tour'));

    expect(await screen.findByText('ReactTour')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close Request' }));
    });

    // Still on /tour, but the tour overlay is dismissed.
    expect(screen.getByTestId('probe-isTourPage').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('probe-isTourOpen').textContent).toBe('false');
    });
  });
});
