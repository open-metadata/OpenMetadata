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
  findAllByTestId,
  findByTestId,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import BotsList from './BotsList';

const mockBotsData = [
  {
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
            config: {
              JWTToken:
                // eslint-disable-next-line max-len
                'eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzYWNoaW5jaGF1cmFzaXlhY2hvdGV5ODciLCJpc0JvdCI6dHJ1ZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJleHAiOjE2NTMzMDM5ODcsImlhdCI6MTY1MjY5OTE4NywiZW1haWwiOiJzYWNoaW5jaGF1cmFzaXlhY2hvdGV5ODdAZ21haWwuY29tIn0.qwcyGU_geL9GsZ58lw5H46eP7OY9GNq3gBS5l3DhvOGTjtqWzFBUdtYwg3KdP0ejXHSMW5DD2I-1jbCZI8tuSRZ0kdN7gt0xEhU3o7pweAcDb38mbPB3sgvNTGqrdX9Ya6ICVVDH3v7jVxJuJcykDxfVYFy6fyrwbrW3RxuyacV9xMUIyrD8EyDuAhth4wpwGnj5NqikQFRdqQYEWZlyafskMad4ghMy2eoFjrSc5vv7KN0bkp1SHGjxr_TAd3Oc9lIMWKquUZthGXQnnj5XKxGl1PJnXqK7l3U25DcCobbc5KxOI2_TUxfFNIfxduoHiWsAUBSqshvh7O7nCqiZqw',
              JWTTokenExpiry: '7',
              JWTTokenExpiresAt: 1653303987652,
            },
            authType: 'JWT',
          },
        },
      ],
      fieldsUpdated: [],
      fieldsDeleted: [],
      previousVersion: 0.1,
    },
    deleted: false,
  },
];

jest.mock('../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreview</p>);
});

describe('Test Bots Listing Component', () => {
  it('Should render all child elements', async () => {
    const { container } = render(<BotsList bots={mockBotsData} />, {
      wrapper: MemoryRouter,
    });

    const botCards = await findAllByTestId(container, 'bot-card');

    expect(botCards).toHaveLength(mockBotsData.length);

    const botCard = botCards[0];

    const botDisplayName = await findByTestId(botCard, 'bot-displayname');

    expect(botDisplayName).toBeInTheDocument();

    const description = queryByText(botCard, /RichTextEditorPreview/i);

    const noDescription = await findByTestId(botCard, 'no-description');

    expect(description).not.toBeInTheDocument();
    expect(noDescription).toBeInTheDocument();
  });

  it('Should render no data placeholder if no bots user available', async () => {
    const { container } = render(<BotsList bots={[]} />, {
      wrapper: MemoryRouter,
    });

    const noData = await findByTestId(container, 'error');

    expect(noData).toBeInTheDocument();
  });
});
