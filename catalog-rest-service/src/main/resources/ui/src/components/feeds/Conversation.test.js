/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { render } from '@testing-library/react';
import React from 'react';
import Conversation from './Conversation';

describe('Test Conversation Component', () => {
  it('Render thread without subthreads', async () => {
    const { findByText } = render(
      <Conversation
        thread={{
          title: 'User bot',
          message: 'Test Message',
          quickReplies: [{ text: 'Quick reply 1' }, { text: 'Quick reply 2' }],
          timestamp: Date.now(),
          relativeTime: '2 day ago',
        }}
      />
    );

    const title = await findByText(/User bot/);

    expect(title).toBeInTheDocument();

    const message = await findByText(/Test Message/);

    expect(message).toBeInTheDocument();

    const qr1 = await findByText(/Quick reply 1/);
    const qr2 = await findByText(/Quick reply 2/);

    expect(qr1).toBeInTheDocument();
    expect(qr2).toBeInTheDocument();

    const timestamp = await findByText(/2 day ago/);

    expect(timestamp).toBeInTheDocument();
  });

  it('Render thread with subthreads', async () => {
    const { findByText, getAllByTestId } = render(
      <Conversation
        thread={{
          title: 'User bot',
          message: 'Test Message',
          quickReplies: [{ text: 'Quick reply 1' }, { text: 'Quick reply 2' }],
          timestamp: Date.now(),
          relativeTime: '2 day ago',
          subThreads: [
            {
              title: 'Test User',
              message: 'Sub thread Test Message',
              timestamp: Date.now(),
              relativeTime: '1 day ago',
            },
          ],
        }}
      />
    );

    const threads = getAllByTestId(/thread/);

    expect(threads).toHaveLength(2);

    const title = await findByText(/Test User/);

    expect(title).toBeInTheDocument();

    const message = await findByText(/Sub thread Test Message/);

    expect(message).toBeInTheDocument();

    const timestamp = await findByText(/1 day ago/);

    expect(timestamp).toBeInTheDocument();
  });
});
