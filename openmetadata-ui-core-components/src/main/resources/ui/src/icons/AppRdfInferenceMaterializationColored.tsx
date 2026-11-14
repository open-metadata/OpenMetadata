/*
 *  Copyright 2025 Collate.
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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const AppRdfInferenceMaterializationColored: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 32 32"
    width={size}
    {...props}>
    <rect
      fill="url(#app-rdf-inference-materialization-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M21.2 18.6v-5.2c0-1.838 0-2.758-.57-3.329-.572-.571-1.49-.571-3.33-.571h-2.6c-1.838 0-2.757 0-3.328.571s-.571 1.49-.571 3.329v5.2c0 1.838 0 2.758.57 3.329.572.571 1.491.571 3.33.571h2.6c1.838 0 2.758 0 3.329-.571.57-.571.57-1.49.57-3.329"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M18.277 9.5h-4.55c0 .92 0 1.379.285 1.664.286.286.745.286 1.665.286h.65c.919 0 1.378 0 1.664-.286.286-.285.286-.745.286-1.664M13.4 17.948H16m-2.6-2.6h5.2"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-rdf-inference-materialization-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#F97794" />
        <stop offset={1} stopColor="#623AA2" />
      </linearGradient>
    </defs>
  </svg>
);
AppRdfInferenceMaterializationColored.displayName =
  'AppRdfInferenceMaterializationColored';
