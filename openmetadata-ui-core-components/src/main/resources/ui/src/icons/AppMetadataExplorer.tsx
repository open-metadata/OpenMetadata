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

export const AppMetadataExplorer: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M8.86 6.466c3.289 0 5.955-1 5.955-2.233S12.149 2 8.86 2C5.572 2 2.906 3 2.906 4.233s2.666 2.233 5.955 2.233M5.139 8.578c.447.135.948.246 1.488.328m2.233 2.768c-3.288 0-5.954-1-5.954-2.233m2.233 4.349c.447.134.948.245 1.488.327"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.86 16.887c-3.288 0-5.954-1-5.954-2.233V4.234m11.909 0v5.21m.87 5.755.165-1.4c.087-.746.131-1.119-.073-1.323-.205-.205-.577-.16-1.323-.073l-1.4.164m2.677-.045-4.165 4.164"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppMetadataExplorer.displayName = 'AppMetadataExplorer';
