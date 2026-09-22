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

export const ShieldTick: FC<Props> = ({
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
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="m9 11.5 2 2L15.5 9m4.5 3c0 4.908-5.354 8.478-7.302 9.615-.221.129-.332.194-.488.227a1.1 1.1 0 0 1-.42 0c-.156-.034-.267-.098-.488-.227C9.354 20.478 4 16.908 4 12V7.217c0-.799 0-1.199.13-1.542a2 2 0 0 1 .548-.79c.276-.243.65-.383 1.398-.664l5.362-2.01c.208-.078.312-.117.419-.133a1 1 0 0 1 .286 0c.107.016.21.055.419.133l5.362 2.01c.748.28 1.123.421 1.398.664a2 2 0 0 1 .547.79c.131.343.131.743.131 1.542z" />
  </svg>
);
ShieldTick.displayName = 'ShieldTick';
