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

// Every emoji PNG resolved to its final asset URL at build time. `?url` +
// `eager: true` in `useImage.assets.ts` means Vite emits each PNG as a static
// asset (no JS chunk) and inlines a URL string into this map. The old
// `await import(`../assets/img/${fileName}.png`)` bundled a chunk for every
// PNG under `assets/img/**` — ~100 wasted chunks for the two emoji callers we
// actually have. The map lives in a separate file so ts-jest can mock it (see
// jest.config.js `moduleNameMapper` — `import.meta.glob` is Vite-only syntax
// that ts-jest cannot parse). Narrow the glob in `useImage.assets.ts` if
// additional callers need images from other subdirectories.
import { emojiUrls } from './useImage.assets';

const useImage = (fileName: string) => {
  const image = emojiUrls[`../assets/img/${fileName}.png`] ?? null;

  return {
    loading: false,
    error: null as Error | null,
    image,
  };
};

export default useImage;
