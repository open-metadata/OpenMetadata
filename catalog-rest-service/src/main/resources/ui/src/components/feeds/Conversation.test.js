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
