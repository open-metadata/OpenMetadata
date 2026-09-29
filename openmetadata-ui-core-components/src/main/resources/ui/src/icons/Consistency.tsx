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

export const Consistency: FC<Props> = ({
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
      d="m12.302 2 .435.813c.294.55.44.824.344.942-.098.118-.418.023-1.058-.167a7.1 7.1 0 0 0-2.024-.293c-3.816 0-6.91 3.002-6.91 6.705 0 1.221.337 2.366.925 3.352M7.696 18l-.435-.813c-.294-.55-.441-.824-.344-.942s.418-.023 1.058.167 1.32.293 2.024.293c3.816 0 6.909-3.002 6.909-6.705a6.5 6.5 0 0 0-.924-3.352"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Consistency.displayName = 'Consistency';
