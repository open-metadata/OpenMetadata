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

export const ChangePreview: FC<Props> = ({
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
      d="M15.25 9.477c.166.235.25.352.25.525s-.084.291-.25.526c-.752 1.053-2.67 3.324-5.25 3.324s-4.498-2.27-5.25-3.324c-.166-.235-.25-.352-.25-.526 0-.173.084-.29.25-.525.752-1.053 2.67-3.325 5.25-3.325s4.498 2.272 5.25 3.325Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.648 10.002a1.65 1.65 0 1 0-3.3 0 1.65 1.65 0 0 0 3.3 0Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <rect rx={3} stroke="currentColor" strokeWidth={1.3} x={2} y={2} />
  </svg>
);
ChangePreview.displayName = 'ChangePreview';
