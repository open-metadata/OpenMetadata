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

export const KnowledgePanels: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M6.8 2.8H5.68c-1.735 0-2.602 0-3.14.54C2 3.879 2 4.746 2 6.48v4.24c0 1.735 0 2.603.539 3.142s1.406.538 3.14.538H7.56a2.49 2.49 0 0 1 2.44 2v-12c-.756-1.006-1.6-1.6-3.2-1.6ZM10 16.4v-12c.755-1.006 1.6-1.6 3.2-1.6h1.12c1.734 0 2.602 0 3.14.54.54.539.54 1.406.54 3.14v4.32m-5.201 4.802s.8.4 1.3 1.6c0 0 2.064-3 3.9-3.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
KnowledgePanels.displayName = 'KnowledgePanels';
