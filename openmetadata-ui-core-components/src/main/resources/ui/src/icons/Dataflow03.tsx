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

export const Dataflow03: FC<Props> = ({
  size = 24,
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M11 4.5h7.3c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874c.218.428.218.988.218 2.108V9c0 .932 0 1.398-.152 1.765a2 2 0 0 1-1.083 1.083C19.898 12 19.432 12 18.5 12M13 19.5H5.7c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C2.5 17.98 2.5 17.42 2.5 16.3V15c0-.932 0-1.398.152-1.765a2 2 0 0 1 1.083-1.083C4.102 12 4.568 12 5.5 12m4.8 2.5h3.4c.28 0 .42 0 .527-.055a.5.5 0 0 0 .218-.218c.055-.107.055-.247.055-.527v-3.4c0-.28 0-.42-.055-.527a.5.5 0 0 0-.218-.218C14.12 9.5 13.98 9.5 13.7 9.5h-3.4c-.28 0-.42 0-.527.055a.5.5 0 0 0-.218.218c-.055.107-.055.247-.055.527v3.4c0 .28 0 .42.055.527a.5.5 0 0 0 .218.218c.107.055.247.055.527.055m7.5 7.5h3.4c.28 0 .42 0 .527-.055a.5.5 0 0 0 .218-.218C22 21.62 22 21.48 22 21.2v-3.4c0-.28 0-.42-.055-.527a.5.5 0 0 0-.218-.218C21.62 17 21.48 17 21.2 17h-3.4c-.28 0-.42 0-.527.055a.5.5 0 0 0-.218.218C17 17.38 17 17.52 17 17.8v3.4c0 .28 0 .42.055.527a.5.5 0 0 0 .218.218c.107.055.247.055.527.055M2.8 7h3.4c.28 0 .42 0 .527-.054a.5.5 0 0 0 .218-.219C7 6.62 7 6.48 7 6.2V2.8c0-.28 0-.42-.054-.527a.5.5 0 0 0-.219-.219C6.62 2 6.48 2 6.2 2H2.8c-.28 0-.42 0-.527.054a.5.5 0 0 0-.219.219C2 2.38 2 2.52 2 2.8v3.4c0 .28 0 .42.054.527a.5.5 0 0 0 .219.218C2.38 7 2.52 7 2.8 7"
      stroke="currentColor"
      strokeWidth={2}
    />
  </svg>
);
Dataflow03.displayName = 'Dataflow03';
