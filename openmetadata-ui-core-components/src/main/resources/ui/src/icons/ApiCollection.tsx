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

export const ApiCollection: FC<Props> = ({
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
      d="M5.2 3.6a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0m12.8 0a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0m0 12.797a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0M5.2 16.4a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0m3.72-9.215-.87.426c-1.1.538-1.65.807-1.65 1.19s.55.651 1.65 1.19l.87.425c.524.256.786.385 1.08.385s.557-.129 1.08-.385l.871-.426c1.1-.538 1.65-.807 1.65-1.19s-.55-.65-1.65-1.189l-.87-.426c-.524-.256-.786-.384-1.08-.384s-.557.128-1.08.384M13.6 11.2c0 .382-.55.65-1.649 1.189l-.87.426c-.524.256-.786.384-1.08.384s-.557-.128-1.08-.384l-.872-.426C6.95 11.85 6.4 11.582 6.4 11.199"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ApiCollection.displayName = 'ApiCollection';
