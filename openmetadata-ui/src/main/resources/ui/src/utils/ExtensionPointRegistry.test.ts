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
import { ExtensionPointRegistry } from './ExtensionPointRegistry';

const POINT = 'app-mode.sidebar.recent';

describe('ExtensionPointRegistry', () => {
  let registry: ExtensionPointRegistry;

  beforeEach(() => {
    registry = new ExtensionPointRegistry();
  });

  it('returns keyed contributions in insertion order', () => {
    registry.contribute({ extensionPointId: POINT, data: { key: 'a' } });
    registry.contribute({ extensionPointId: POINT, data: { key: 'b' } });

    expect(registry.getContributions(POINT)).toEqual([
      { key: 'a' },
      { key: 'b' },
    ]);
  });

  it('is idempotent for a repeated key: replaces rather than duplicates', () => {
    registry.contribute({
      extensionPointId: POINT,
      data: { key: 'a', v: 1 },
    });
    // Simulates contributeExtensions running again (installed-apps effect
    // re-fires) — the same key must not produce a second entry.
    registry.contribute({
      extensionPointId: POINT,
      data: { key: 'a', v: 2 },
    });

    const contributions = registry.getContributions(POINT);

    expect(contributions).toHaveLength(1);
    expect(contributions[0]).toEqual({ key: 'a', v: 2 });
  });

  it('appends keyless contributions unchanged (e.g. last-wins fallback)', () => {
    registry.contribute({ extensionPointId: POINT, data: { element: 1 } });
    registry.contribute({ extensionPointId: POINT, data: { element: 2 } });

    expect(registry.getContributions(POINT)).toHaveLength(2);
  });

  it('returns an empty array for an unknown extension point', () => {
    expect(registry.getContributions('nope')).toEqual([]);
  });
});
