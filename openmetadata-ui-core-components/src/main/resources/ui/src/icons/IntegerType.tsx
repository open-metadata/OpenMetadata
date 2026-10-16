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

export const IntegerType: FC<Props> = ({
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
      d="M2 10c0-3.771 0-4.657 1.172-5.828S6.229 3 10 3s5.657 0 6.828 1.172S18 6.229 18 10c0 2.771 0 4.657-1.172 5.829S13.771 17 10 17s-5.657 0-6.828-1.171S2 12.77 2 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m15.262 12.2-1.604 1.603-1.604-1.604m3.208-4.402-1.604-1.604-1.604 1.604"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.577 11.991V8.876a.98.98 0 0 1-.704.275.596.596 0 0 1-.592-.6q0-.243.142-.353.141-.117.356-.232.21-.138.43-.335l.403-.365q.18-.167.257-.201a.5.5 0 0 1 .163-.056q.07-.013.197-.013.288 0 .425.142a.7.7 0 0 1 .185.373q.043.228.043.498v3.982q0 .27-.043.502a.7.7 0 0 1-.18.374q-.138.137-.43.137-.286 0-.429-.137a.7.7 0 0 1-.18-.374 3 3 0 0 1-.043-.502"
      fill="currentColor"
    />
  </svg>
);
IntegerType.displayName = 'IntegerType';
