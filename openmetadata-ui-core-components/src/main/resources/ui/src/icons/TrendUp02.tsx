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

export const TrendUp02: FC<Props> = ({
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
      d="m16.667 5-6.392 6.392c-.279.279-.418.418-.579.472a.68.68 0 0 1-.435 0c-.161-.054-.3-.193-.579-.472L6.775 9.485c-.279-.279-.418-.418-.579-.472a.68.68 0 0 0-.435 0c-.161.054-.3.193-.579.472L1.667 13"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path d="M16.667 9.167V5H12.5" stroke="currentColor" strokeWidth={1.3} />
  </svg>
);
TrendUp02.displayName = 'TrendUp02';
