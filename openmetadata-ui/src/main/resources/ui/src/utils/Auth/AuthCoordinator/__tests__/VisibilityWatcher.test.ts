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

import { VisibilityWatcher } from '../VisibilityWatcher';

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('VisibilityWatcher', () => {
  afterEach(() => setVisibility('visible'));

  it('calls onVisible when the document becomes visible', () => {
    const watcher = new VisibilityWatcher();
    const onVisible = jest.fn();
    const onHidden = jest.fn();
    watcher.start(onVisible, onHidden);
    setVisibility('hidden');
    setVisibility('visible');

    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(onHidden).toHaveBeenCalledTimes(1);

    watcher.stop();
  });

  it('stop removes the listener', () => {
    const watcher = new VisibilityWatcher();
    const onVisible = jest.fn();
    watcher.start(onVisible, () => undefined);
    watcher.stop();
    setVisibility('hidden');
    setVisibility('visible');

    expect(onVisible).not.toHaveBeenCalled();
  });
});
