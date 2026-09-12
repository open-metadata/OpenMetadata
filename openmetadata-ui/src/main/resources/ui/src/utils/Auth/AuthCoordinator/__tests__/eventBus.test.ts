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

import { TypedEventBus } from '../eventBus';
import type { RefreshedPayload } from '../types';

describe('TypedEventBus', () => {
  it('delivers emitted payloads to subscribers', () => {
    const bus = new TypedEventBus();
    const received: RefreshedPayload[] = [];
    bus.on('refreshed', (p) => received.push(p));

    bus.emit('refreshed', { idToken: 'abc', expiresAt: 42 });

    expect(received).toEqual([{ idToken: 'abc', expiresAt: 42 }]);
  });

  it('unsubscribes when returned function is called', () => {
    const bus = new TypedEventBus();
    const received: RefreshedPayload[] = [];
    const off = bus.on('refreshed', (p) => received.push(p));

    off();
    bus.emit('refreshed', { idToken: 'abc', expiresAt: 42 });

    expect(received).toEqual([]);
  });

  it('isolates handlers across event types', () => {
    const bus = new TypedEventBus();
    const refreshed: unknown[] = [];
    const failed: unknown[] = [];
    bus.on('refreshed', (p) => refreshed.push(p));
    bus.on('refresh-failed', (p) => failed.push(p));

    bus.emit('refresh-failed', { reason: 'network' });

    expect(refreshed).toEqual([]);
    expect(failed).toEqual([{ reason: 'network' }]);
  });
});
