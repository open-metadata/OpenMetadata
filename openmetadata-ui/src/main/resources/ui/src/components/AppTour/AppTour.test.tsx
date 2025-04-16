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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrentTourPageType } from '../../enums/tour.enum';
import Tour from './Tour';

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

jest.mock('../Modals/TourEndModal/TourEndModal', () =>
  jest.fn().mockImplementation(({ visible, onSave }) => (
    <>
      {visible ? 'TourEndModal is open' : 'TourEndModal is close'}
      <button onClick={onSave}>OnSave_TourEndModal</button>
    </>
  ))
);

const mockUpdateIsTourOpen = jest.fn();
const mockUpdateTourPage = jest.fn();
const mockPush = jest.fn();
const mockProps = {
  steps: [] as TourSteps[],
};
const mockUseTourProvider = jest.fn().mockReturnValue({
  isTourOpen: true,
  updateIsTourOpen: mockUpdateIsTourOpen,
  updateTourPage: mockUpdateTourPage,
});

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockImplementation(() => mockUseTourProvider()),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

describe('AppTour component', () => {
  it('element render and actions check', () => {
    render(<Tour {...mockProps} />);

    expect(screen.getByText('ReactTour')).toBeInTheDocument();
    expect(screen.getByText('TourEndModal is close')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Close Request' }));

    expect(mockUpdateIsTourOpen).toHaveBeenCalledWith(false);

    userEvent.click(screen.getByRole('button', { name: 'Skip Request' }));

    expect(mockUpdateTourPage).toHaveBeenCalledWith(
      CurrentTourPageType.MY_DATA_PAGE
    );
    expect(mockPush).toHaveBeenCalledWith('/');

    userEvent.click(screen.getByTestId('last-step-button'));

    expect(screen.getByText('TourEndModal is open')).toBeInTheDocument();
  });

  it('should not render ReactTour if isTourOpen false', () => {
    mockUseTourProvider.mockReturnValueOnce({ isTourOpen: false });

    render(<Tour {...mockProps} />);

    expect(screen.queryByText('ReactTour')).not.toBeInTheDocument();
  });
});
