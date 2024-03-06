/*
 *  Copyright 2022 Collate.
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
  findByTestId,
  findByText,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { getAuthMechanismForBotUser } from '../../../../rest/userAPI';
import BotDetails from './BotDetails.component';

const revokeTokenHandler = jest.fn();
const updateBotsDetails = jest.fn();
const onEmailChange = jest.fn();
const updateUserDetails = jest.fn();

const botUserData = {
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
  deleted: false,
};

const botData = {
  id: '4755f87d-2a53-4376-97e6-fc072f29cf5a',
  name: 'ingestion-bot',
  fullyQualifiedName: 'ingestion-bot',
  displayName: 'ingestion-bot',
  botUser: {
    id: 'b91d42cb-2a02-4364-ae80-db08b77f1b0c',
    type: 'user',
    name: 'ingestion-bot',
    fullyQualifiedName: 'ingestion-bot',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/b91d42cb-2a02-4364-ae80-db08b77f1b0c',
  },
  version: 0.1,
  updatedAt: 1664267598781,
  updatedBy: 'ingestion-bot',
  href: 'http://localhost:8585/api/v1/bots/4755f87d-2a53-4376-97e6-fc072f29cf5a',
  deleted: false,
};

const mockAuthMechanism = {
  config: {
    JWTToken:
      // eslint-disable-next-line max-len
      'eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzYWNoaW5jaGF1cmFzaXlhY2hvdGV5ODciLCJpc0JvdCI6dHJ1ZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJleHAiOjE2NjY3OTE5NjAsImlhdCI6MTY2NDE5OTk2MCwiZW1haWwiOiJzYWNoaW5jaGF1cmFzaXlhY2hvdGV5ODdAZ21haWwuY29tIn0.e5y5hh61EksbcWlLet_GpE84raDYvMho6OXAOLe5MCKrimHYj1roqoY54PFlJDSdrPWJOOeAFsTOxlqnMB_FGhOIufNW9yJwlkIOspWCusNJisLpv8_oYw9ZbrB5ATKyDz9MLTaZRZptx3JirA7s6tV-DJZId-mNzQejW2kiecYZeLZ-ipHqQeVxfzryfxUqcBUGTv-_de0uxlPdklqBuwt24bCy29qVIGxUweFDhrstmdRx_ZyQdrRvmeMHifUB6FCB1OBbII8mKYvF2P0CWF_SsxVLlRHUeOsxKeAeUk1MAA1mHm4UYdMD9OAuFMTZ10gpiELebVWiKrFYYjdICA',
    JWTTokenExpiry: '30',
    JWTTokenExpiresAt: 1666791960664,
  },
  authType: 'JWT',
};

const mockProp = {
  botUserData,
  botData,
  isAdminUser: true,
  isAuthDisabled: false,
  botPermission: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  revokeTokenHandler,
  updateBotsDetails,
  onEmailChange,
  updateUserDetails,
};

jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../rest/userAPI', () => {
  return {
    createUserWithPut: jest
      .fn()
      .mockImplementation(() => Promise.resolve(botUserData)),
    getAuthMechanismForBotUser: jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockAuthMechanism)),
  };
});

jest.mock('../../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});

jest.mock('./AuthMechanismForm', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="AuthMechanismForm">AuthMechanismForm</div>
    )
);

jest.mock('../../../PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children, leftPanel, rightPanel, header }) => (
      <div>
        <div>{leftPanel}</div>
        {header}
        {children}
        <div>{rightPanel}</div>
      </div>
    ))
);

describe('Test BotsDetail Component', () => {
  it('Should render all child elements', async () => {
    const { container } = render(<BotDetails {...mockProp} />, {
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
    const { container } = render(<BotDetails {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const tokenElement = await findByTestId(container, 'token');
    const tokenExpiry = await findByTestId(container, 'token-expiry');

    expect(tokenElement).toBeInTheDocument();
    expect(tokenExpiry).toBeInTheDocument();
  });

  it('Test Revoke token flow', async () => {
    await act(async () => {
      render(<BotDetails {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const revokeButton = await screen.findByTestId('revoke-button');

    expect(revokeButton).toBeInTheDocument();

    fireEvent.click(revokeButton);

    // should open confirmartion before revoking token
    const confirmationModal = await screen.findByTestId('confirmation-modal');

    expect(confirmationModal).toBeInTheDocument();

    const confirmButton = await screen.findByTestId('save-button');

    expect(confirmButton).toBeInTheDocument();

    fireEvent.click(confirmButton);

    // revoke token handler should get called
    expect(revokeTokenHandler).toHaveBeenCalled();
  });

  it('Should render the generate form if the authmechanism is empty', async () => {
    (getAuthMechanismForBotUser as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve(undefined);
    });

    const { container } = render(<BotDetails {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const authMechanismForm = await findByText(container, 'label.om-jwt-token');

    expect(authMechanismForm).toBeInTheDocument();
  });
});
