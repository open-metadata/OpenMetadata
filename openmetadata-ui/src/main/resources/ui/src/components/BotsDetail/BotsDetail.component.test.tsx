/*
 *  Copyright 2021 Collate
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
  findByTestId,
  fireEvent,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { generateUserToken, getUserToken } from '../../axiosAPIs/userAPI';
import BotsDetail from './BotsDetail.component';

const revokeTokenHandler = jest.fn();
const updateBotsDetails = jest.fn();

const mockToken = {
  JWTToken:
    // eslint-disable-next-line max-len
    'eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzYWNoaW5jaGF1cmFzaXlhY2hvdGV5ODciLCJpc0JvdCI6dHJ1ZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJleHAiOjE2NTMzMDM5ODcsImlhdCI6MTY1MjY5OTE4NywiZW1haWwiOiJzYWNoaW5jaGF1cmFzaXlhY2hvdGV5ODdAZ21haWwuY29tIn0.qwcyGU_geL9GsZ58lw5H46eP7OY9GNq3gBS5l3DhvOGTjtqWzFBUdtYwg3KdP0ejXHSMW5DD2I-1jbCZI8tuSRZ0kdN7gt0xEhU3o7pweAcDb38mbPB3sgvNTGqrdX9Ya6ICVVDH3v7jVxJuJcykDxfVYFy6fyrwbrW3RxuyacV9xMUIyrD8EyDuAhth4wpwGnj5NqikQFRdqQYEWZlyafskMad4ghMy2eoFjrSc5vv7KN0bkp1SHGjxr_TAd3Oc9lIMWKquUZthGXQnnj5XKxGl1PJnXqK7l3U25DcCobbc5KxOI2_TUxfFNIfxduoHiWsAUBSqshvh7O7nCqiZqw',
  JWTTokenExpiry: '7',
  JWTTokenExpiresAt: 1653303987652,
};

const botsData = {
  id: 'ea09aed1-0251-4a75-b92a-b65641610c53',
  name: 'sachinchaurasiyachotey87',
  fullyQualifiedName: 'sachinchaurasiyachotey87',
  displayName: 'Sachin Chaurasiya',
  version: 0.2,
  updatedAt: 1652699178358,
  updatedBy: 'anonymous',
  email: 'sachinchaurasiyachotey87@gmail.com',
  href: 'http://localhost:8585/api/v1/users/ea09aed1-0251-4a75-b92a-b65641610c53',
  isBot: true,
  isAdmin: false,
  changeDescription: {
    fieldsAdded: [
      {
        name: 'authenticationMechanism',
        newValue: {
          config: mockToken,
          authType: 'JWT',
        },
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.1,
  },
  deleted: false,
};

const mockProp = {
  botsData,
  revokeTokenHandler,
  updateBotsDetails,
};

jest.mock('../../axiosAPIs/userAPI', () => {
  return {
    generateUserToken: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: mockToken })),
    getUserToken: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: mockToken })),
  };
});

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});

describe('Test BotsDetail Component', () => {
  it('Should render all child elements', async () => {
    const { container } = render(<BotsDetail {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const breadCrumb = await findByTestId(container, 'breadcrumb');

    const leftPanel = await findByTestId(container, 'left-panel');
    const rightPanel = await findByTestId(container, 'right-panel');
    const centerPanel = await findByTestId(container, 'center-panel');

    expect(breadCrumb).toBeInTheDocument();
    expect(leftPanel).toBeInTheDocument();
    expect(rightPanel).toBeInTheDocument();
    expect(centerPanel).toBeInTheDocument();
  });

  it('Should render token if token is present', async () => {
    const { container } = render(<BotsDetail {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const tokenElement = await findByTestId(container, 'token');
    const tokenExpiry = await findByTestId(container, 'token-expiry');

    expect(tokenElement).toBeInTheDocument();
    expect(tokenExpiry).toBeInTheDocument();
  });

  it('Should render no token placeholder if token is not present', async () => {
    (getUserToken as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: { ...mockToken, JWTToken: '', JWTTokenExpiresAt: '' },
      })
    );
    const { container } = render(<BotsDetail {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const tokenElement = queryByTestId(container, 'token');
    const tokenExpiry = queryByTestId(container, 'token-expiry');

    expect(tokenElement).not.toBeInTheDocument();
    expect(tokenExpiry).not.toBeInTheDocument();

    const noToken = await findByTestId(container, 'no-token');

    expect(noToken).toBeInTheDocument();
  });

  it('Should render generate token form if generate token button is clicked', async () => {
    (getUserToken as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: { ...mockToken, JWTToken: '', JWTTokenExpiresAt: '' },
      })
    );
    const { container } = render(<BotsDetail {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const generateToken = await findByTestId(container, 'generate-token');

    expect(generateToken).toHaveTextContent('Generate new token');

    fireEvent.click(generateToken);

    const tokenForm = await findByTestId(container, 'generate-token-form');

    expect(tokenForm).toBeInTheDocument();

    const confirmButton = await findByTestId(tokenForm, 'confirm-button');
    const discardButton = await findByTestId(tokenForm, 'discard-button');

    expect(confirmButton).toBeInTheDocument();
    expect(discardButton).toBeInTheDocument();
  });

  it('Should call generate token API if generate token button is clicked', async () => {
    (getUserToken as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: { ...mockToken, JWTToken: '', JWTTokenExpiresAt: '' },
      })
    );
    const { container } = render(<BotsDetail {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const generateToken = await findByTestId(container, 'generate-token');

    expect(generateToken).toHaveTextContent('Generate new token');

    fireEvent.click(generateToken);

    const tokenForm = await findByTestId(container, 'generate-token-form');

    expect(tokenForm).toBeInTheDocument();

    const confirmButton = await findByTestId(tokenForm, 'confirm-button');
    const discardButton = await findByTestId(tokenForm, 'discard-button');

    expect(confirmButton).toBeInTheDocument();
    expect(discardButton).toBeInTheDocument();

    fireEvent.click(confirmButton);

    expect(generateUserToken).toBeCalled();
  });
});
