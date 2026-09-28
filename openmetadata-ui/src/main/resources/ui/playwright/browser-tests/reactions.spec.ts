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
import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'path';
import { reactOnFeedCard } from '../utils/activityFeed';

const bundle = build({
  stdin: {
    contents: `import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import Reactions from './src/components/ActivityFeed/Reactions/Reactions';
      import { useApplicationStore } from './src/hooks/useApplicationStore';
      useApplicationStore.setState({ currentUser: {id:'reactor', name:'reactor'} });
      function App() {
        const [reactions, setReactions] = useState(location.search === '?existing'
          ? [{ reactionType: 'thumbsUp', user: {id:'other', name:'other', type:'user'} }]
          : []);
        const [error, setError] = useState('');
        const update = async (reaction, operation) => {
          const response = await fetch('/api/v1/activity/card/reaction/' + reaction, { method: operation === 'add' ? 'PUT' : 'DELETE' });
          if (!response.ok) { setError('Unable to update reaction'); return; }
          setError('');
          setReactions(await response.json());
        };
        return <div style={{ marginTop: 300 }} data-testid="card"><Reactions reactions={reactions} onReactionSelect={update} />{error && <div role="alert">{error}</div>}</div>;
      }
      createRoot(document.getElementById('root')).render(<App />);`,
    loader: 'tsx',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  jsx: 'automatic',
  alias: {
    react: resolve('node_modules/react'),
    'react-dom': resolve('node_modules/react-dom'),
  },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
  plugins: [
    {
      name: 'asset-boundaries',
      setup(builder) {
        builder.onLoad({ filter: /\.svg$/ }, () => ({
          contents:
            'import React from "react"; export const ReactComponent = props => React.createElement("svg", {width:16,height:16,...props}); export default "";',
          loader: 'js',
        }));
        builder.onLoad({ filter: /\.less$/ }, () => ({
          contents: '',
          loader: 'js',
        }));
        builder.onLoad({ filter: /useImage\.assets\.ts$/ }, () => ({
          contents: 'export const emojiUrls = {};',
          loader: 'js',
        }));
      },
    },
  ],
}).then((result) => result.outputFiles[0].text);

test('every reaction can be selected and removed through the animated product popover', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const reactions = new Set<string>();
  const operations: string[] = [];
  await page.route('http://reactions.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
  );
  await page.route('**/api/v1/activity/card/reaction/*', async (route) => {
    const reaction = new URL(route.request().url()).pathname.split('/').pop()!;
    const method = route.request().method();
    operations.push(`${method}:${reaction}`);
    if (method === 'PUT') reactions.add(reaction);
    else reactions.delete(reaction);
    await route.fulfill({
      json: [...reactions].map((reactionType) => ({
        reactionType,
        user: { id: 'reactor', name: 'reactor', type: 'user' },
      })),
    });
  });
  await page.goto('http://reactions.test/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ path: 'node_modules/antd/dist/antd.css' });
  await page.addStyleTag({
    content:
      '.ant-popover-feed-reactions .ant-popover-inner-content {display:flex; gap:8px} .ant-btn-popover-reaction {font-size:20px} .ant-zoom-big-appear,.ant-zoom-big-enter,.ant-zoom-big-leave {animation-duration:0.4s !important}',
  });
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.addScriptTag({ content: await bundle });
  const card = page.getByTestId('card');
  await reactOnFeedCard(page, card);
  await expect(card.getByTestId('emoji-button')).toHaveCount(8);
  await reactOnFeedCard(page, card);
  await expect(card.getByTestId('emoji-button')).toHaveCount(0);
  expect(operations).toEqual([
    ...[
      'thumbsUp',
      'thumbsDown',
      'laugh',
      'hooray',
      'confused',
      'heart',
      'eyes',
      'rocket',
    ].map((reaction) => `PUT:${reaction}`),
    ...[
      'thumbsUp',
      'thumbsDown',
      'laugh',
      'hooray',
      'confused',
      'heart',
      'eyes',
      'rocket',
    ].map((reaction) => `DELETE:${reaction}`),
  ]);
});

test('an existing reaction remains usable after completion and a rejected update', async ({
  page,
}) => {
  const other = {
    reactionType: 'thumbsUp',
    user: { id: 'other', name: 'other', type: 'user' },
  };
  const mine = {
    reactionType: 'thumbsUp',
    user: { id: 'reactor', name: 'reactor', type: 'user' },
  };
  const operations: string[] = [];
  await page.route('http://reactions.test/?existing', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' })
  );
  await page.route(
    '**/api/v1/activity/card/reaction/thumbsUp',
    async (route) => {
      const method = route.request().method();
      operations.push(method);
      await route.fulfill(
        operations.length === 3
          ? { status: 503, json: { message: 'Unavailable' } }
          : { json: method === 'PUT' ? [other, mine] : [other] }
      );
    }
  );
  await page.goto('http://reactions.test/?existing', {
    waitUntil: 'domcontentloaded',
  });
  await page.addStyleTag({ path: 'node_modules/antd/dist/antd.css' });
  await page.addScriptTag({ content: await bundle });
  const button = page.getByTestId('emoji-button');
  await expect(button).toHaveText(/1$/);
  await button.click();
  await expect.poll(() => operations).toEqual(['PUT']);
  await expect(button).toHaveText(/2$/);
  await button.click();
  await expect(button).toHaveText(/1$/);
  await button.click();
  await expect(page.getByRole('alert')).toHaveText('Unable to update reaction');
  await expect(button).toHaveText(/1$/);
  await button.click();
  await expect(button).toHaveText(/2$/);
  await expect(page.getByRole('alert')).toBeHidden();
  expect(operations).toEqual(['PUT', 'DELETE', 'PUT', 'PUT']);
});
