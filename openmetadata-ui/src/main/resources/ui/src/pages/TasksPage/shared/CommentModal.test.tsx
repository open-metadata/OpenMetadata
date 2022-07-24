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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { Thread } from '../../../generated/entity/feed/thread';
import CommentModal from './CommentModal';

const mockProps = {
  taskDetail: {
    id: 'e7c2df5f-c4c7-41dd-b5bf-ef01af12ce45',
    type: 'Task',
    href: 'http://localhost:8585/api/v1/feed/e7c2df5f-c4c7-41dd-b5bf-ef01af12ce45',
    threadTs: 1658223754270,
    about:
      '<#E::table::sample_data.ecommerce_db.shopify.raw_product_catalog::description>',
    entityId: 'af1ee0d5-6139-4b4d-969e-2de615520b69',
    createdBy: 'sachin.c',
    updatedAt: 1658226190515,
    updatedBy: 'sachin.c',
    resolved: false,
    message: 'Update description for table',
    postsCount: 0,
    posts: [],
    reactions: [],
    task: {
      id: 3,
      type: 'UpdateDescription',
      assignees: [
        {
          id: '0462fc29-d89a-40eb-b54c-a0d01ff51e41',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
        {
          id: 'a1904bae-e3dd-45d8-94e9-a4a60f6985a8',
          type: 'user',
          name: 'sachin.c',
          fullyQualifiedName: 'sachin.c',
          displayName: 'Sachin Chaurasiya',
          deleted: false,
        },
      ],
      status: 'Open',
      oldValue:
        'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB.',
      suggestion:
        'This is a raw product catalogue table containing the product listing, price, seller etc.. represented in our online DB.',
    },
  } as Thread,
  comment: '',
  isVisible: true,
  setComment: jest.fn(),
  onClose: jest.fn(),
  onConfirm: jest.fn(),
};

jest.mock('../../../components/common/rich-text-editor/RichTextEditor', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="richTextEditor">RichTextEditor</div>)
);

describe('Test Comment Modal component', () => {
  it('Should render the component', async () => {
    render(<CommentModal {...mockProps} />);

    const container = await screen.findByTestId('comment-modal');

    const editor = await screen.findByTestId('richTextEditor');

    const title = await screen.findByText(
      `Close Task #${mockProps.taskDetail.task?.id} ${mockProps.taskDetail.message}`
    );

    const cancelButton = await screen.findByText('Cancel');
    const confirmButton = await screen.findByText('Close with comment');

    expect(container).toBeInTheDocument();
    expect(editor).toBeInTheDocument();
    expect(title).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
  });
});
