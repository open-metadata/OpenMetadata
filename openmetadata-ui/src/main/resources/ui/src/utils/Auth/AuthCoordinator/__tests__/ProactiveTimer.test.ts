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

import { ProactiveTimer } from '../ProactiveTimer';

describe('ProactiveTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires callback bufferMs before expiresAt', () => {
    const timer = new ProactiveTimer(60_000);
    const cb = jest.fn();

    timer.schedule(300_000, cb); // 5min from epoch
    jest.advanceTimersByTime(239_000);

    expect(cb).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000); // total 240_000 = 300_000 - 60_000

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires immediately when expiresAt is already within buffer', () => {
    const timer = new ProactiveTimer(60_000);
    const cb = jest.fn();
    timer.schedule(30_000, cb); // 30s from epoch, buffer 60s
    jest.advanceTimersByTime(0);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancels the prior schedule when re-scheduled', () => {
    const timer = new ProactiveTimer(60_000);
    const first = jest.fn();
    const second = jest.fn();
    timer.schedule(300_000, first);
    timer.schedule(600_000, second);
    jest.advanceTimersByTime(240_000);

    expect(first).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300_000);

    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancel() prevents pending fire', () => {
    const timer = new ProactiveTimer(60_000);
    const cb = jest.fn();
    timer.schedule(300_000, cb);
    timer.cancel();
    jest.advanceTimersByTime(1_000_000);

    expect(cb).not.toHaveBeenCalled();
    expect(timer.isScheduled()).toBe(false);
  });

  it('does not schedule when expiresAt is 0 (opaque / undecodable token)', () => {
    // Guards against a tight refresh loop: an opaque token bubbles up as
    // `expiresAt = 0` from the renewer, which would otherwise fire the
    // callback immediately, reschedule, and hammer the IdP.
    const timer = new ProactiveTimer(60_000);
    const cb = jest.fn();
    timer.schedule(0, cb);
    jest.advanceTimersByTime(1_000_000);

    expect(cb).not.toHaveBeenCalled();
    expect(timer.isScheduled()).toBe(false);
  });

  it('does not schedule when expiresAt is negative or NaN', () => {
    const timer = new ProactiveTimer(60_000);
    const cb = jest.fn();
    timer.schedule(-1_000, cb);
    timer.schedule(Number.NaN, cb);
    jest.advanceTimersByTime(1_000_000);

    expect(cb).not.toHaveBeenCalled();
    expect(timer.isScheduled()).toBe(false);
  });
});
