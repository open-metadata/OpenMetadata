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

export const AppRdfGraphIndexingColored: FC<Props> = ({
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
      fill="url(#app-rdf-graph-indexing-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M21.852 20.875a1.625 1.625 0 1 1-3.25 0 1.625 1.625 0 0 1 3.25 0m0-6.504a1.625 1.625 0 1 1-3.25 0 1.625 1.625 0 0 1 3.25 0M13.4 17.625a1.625 1.625 0 1 1-3.25 0 1.625 1.625 0 0 1 3.25 0m0-6.5a1.625 1.625 0 1 1-3.25 0 1.625 1.625 0 0 1 3.25 0m0 0 4.875 3.25-4.55 3.25 4.875 3.25"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-rdf-graph-indexing-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#72EDF2" />
        <stop offset={1} stopColor="#5151E5" />
      </linearGradient>
    </defs>
  </svg>
);
AppRdfGraphIndexingColored.displayName = 'AppRdfGraphIndexingColored';
