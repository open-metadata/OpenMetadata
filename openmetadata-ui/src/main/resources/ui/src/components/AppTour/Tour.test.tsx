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
import { TourSteps } from '@deuex-solutions/react-tour';
import { render, screen } from '@testing-library/react';
import Tour from './Tour';

// The shape Vite's dev pre-bundle gives a UMD package: the whole `module.exports`
// as the default export, so the component sits one `default` deeper.
jest.mock('@deuex-solutions/react-tour', () => ({
  __esModule: true,
  default: {
    __esModule: true,
    default: jest.fn().mockImplementation(() => <p>ReactTour</p>),
  },
}));

jest.mock('../Modals/TourEndModal/TourEndModal', () =>
  jest.fn().mockImplementation(() => null)
);

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockImplementation(() => ({
    isTourOpen: true,
    updateIsTourOpen: jest.fn(),
    updateTourPage: jest.fn(),
  })),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

describe('Tour', () => {
  it('renders react-tour when its module default is nested one level deeper', async () => {
    render(<Tour steps={[] as TourSteps[]} />);

    expect(await screen.findByText('ReactTour')).toBeInTheDocument();
  });
});
