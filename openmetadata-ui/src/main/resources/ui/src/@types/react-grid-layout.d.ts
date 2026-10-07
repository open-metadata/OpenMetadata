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
import 'react-grid-layout';

// react-grid-layout exports its layout helpers at runtime, but
// @types/react-grid-layout does not declare them.
declare module 'react-grid-layout' {
  export const utils: {
    moveElement: (
      layout: Layout[],
      item: Layout,
      x: number | undefined,
      y: number | undefined,
      isUserAction: boolean,
      preventCollision: boolean,
      compactType: 'vertical' | 'horizontal' | null,
      cols: number
    ) => Layout[];
    compact: (
      layout: Layout[],
      compactType: 'vertical' | 'horizontal' | null,
      cols: number
    ) => Layout[];
    correctBounds: (layout: Layout[], bounds: { cols: number }) => Layout[];
    bottom: (layout: Layout[]) => number;
  };
}
