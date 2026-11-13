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

export const SecuritySafe: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M16.897 9.294c0 3.914-2.75 7.58-6.507 8.652a1.47 1.47 0 0 1-.79 0c-3.756-1.073-6.506-4.738-6.506-8.652V5.78c0-.656.48-1.4 1.076-1.649l4.315-1.825a3.9 3.9 0 0 1 3.028 0l4.315 1.825c.589.248 1.077.993 1.077 1.649z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.08 10.415c.89 0 1.613-.746 1.613-1.666s-.723-1.667-1.613-1.667c-.891 0-1.613.746-1.613 1.667 0 .92.722 1.666 1.613 1.666m0 .003v2.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SecuritySafe.displayName = 'SecuritySafe';
