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

export const Lineage: FC<Props> = ({
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
      d="M12.183 10H8.547m3.636-5.602c-.764 0-1.382.62-1.382 1.382v8.437a1.38 1.38 0 0 0 1.381 1.381"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <rect rx={3.2} stroke="currentColor" strokeWidth={1.3} x={2} y={6.801} />
    <circle cx={16} cy={4} r={1.35} stroke="currentColor" strokeWidth={1.3} />
    <circle
      cx={16}
      cy={9.602}
      r={1.35}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle cx={16} cy={16} r={1.35} stroke="currentColor" strokeWidth={1.3} />
  </svg>
);
Lineage.displayName = 'Lineage';
