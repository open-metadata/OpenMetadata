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
import { fireEvent, render, screen } from '@testing-library/react';
import { mockApplicationData } from '../../../../mocks/rests/applicationAPI.mock';
import { mockUserData } from '../../Users/mocks/User.mocks';
import AppInstallVerifyCard from './AppInstallVerifyCard.component';

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: jest.fn().mockReturnValue('getRelativeTime'),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
    theme: {
      primaryColor: '#00ff00',
    },
  })),
}));

jest.mock('../../../common/BrandImage/BrandImage', () =>
  jest.fn().mockReturnValue(<div>BrandImage</div>)
);

jest.mock('../../../common/PopOverCard/UserPopOverCard', () => {
  return jest.fn().mockImplementation(() => <>UserPopOverCard</>);
});

jest.mock('../AppLogo/AppLogo.component', () =>
  jest.fn().mockImplementation(() => <>AppLogo</>)
);

jest.mock('../../../../constants/constants', () => ({
  LIGHT_GREEN_COLOR: '#00ff00',
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  Transi18next: jest.fn().mockReturnValue('Transi18next'),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const mockProps = {
  appData: mockApplicationData,
  nextButtonLabel: 'Next Button',
  onCancel: mockOnCancel,
  onSave: mockOnSave,
};

describe('AppInstallVerifyCard', () => {
  it('should contain all necessary elements', () => {
    render(<AppInstallVerifyCard {...mockProps} />);

    expect(screen.getByText('AppLogo')).toBeInTheDocument();
    expect(screen.getByText('BrandImage')).toBeInTheDocument();
    expect(screen.getByText('label.authorize-app')).toBeInTheDocument();
    expect(screen.getByText('UserPopOverCard')).toBeInTheDocument();

    expect(
      screen.getByText('label.wants-to-access-your-account')
    ).toBeInTheDocument();
    expect(screen.getByText('label.all-entity')).toBeInTheDocument();
    expect(
      screen.getByText('label.developed-by-developer')
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.updated getRelativeTime')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));

    expect(mockOnCancel).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Next Button' }));

    expect(mockOnSave).toHaveBeenCalled();
  });
});
