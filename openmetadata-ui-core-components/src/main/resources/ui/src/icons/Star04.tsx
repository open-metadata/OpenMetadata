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

export const Star04: FC<Props> = ({
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
      d="m10 1.667 1.677 4.359c.235.611.353.917.535 1.173.163.228.361.427.589.589.257.183.563.3 1.173.535L18.333 10l-4.359 1.677c-.611.235-.917.353-1.173.535a2.5 2.5 0 0 0-.589.589c-.182.257-.3.563-.535 1.173L10 18.333l-1.677-4.359c-.235-.611-.352-.917-.535-1.173a2.5 2.5 0 0 0-.589-.589c-.257-.182-.563-.3-1.173-.535L1.667 10l4.359-1.677c.611-.235.917-.352 1.173-.535a2.5 2.5 0 0 0 .589-.589c.183-.257.3-.563.535-1.173z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Star04.displayName = 'Star04';
