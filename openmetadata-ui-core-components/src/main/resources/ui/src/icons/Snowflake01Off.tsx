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

export const Snowflake01Off: FC<Props> = ({
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
      d="m13.664 11.689 1.94-1.144a.547.547 0 0 1 .554.94l-1.408.831 1.625.938a.55.55 0 0 1 .2.746.546.546 0 0 1-.746.2l-1.625-.938-.016 1.634a.546.546 0 0 1-.545.541h-.005a.546.546 0 0 1-.541-.55l.021-2.252-2.925-1.69v3.378l1.961 1.108a.546.546 0 0 1-.538.95l-1.423-.804v1.877a.547.547 0 0 1-1.092 0v-1.877l-1.424.805a.546.546 0 1 1-.537-.951l1.96-1.108v-2.86l2.088-1.204zm-7.468 3.198a.546.546 0 0 1-.54.55H5.65a.547.547 0 0 1-.546-.54l-.01-1.12 1.086-.628zm-2.92-4.4a.55.55 0 0 1 .413.058l1.486.875-1.086.627-.954-.562a.55.55 0 0 1-.251-.334.55.55 0 0 1 .391-.665M9.645 2a.55.55 0 0 1 .547.546v1.877l1.423-.805a.55.55 0 0 1 .744.207.546.546 0 0 1-.206.743l-1.96 1.109v2.846l-2.1 1.211L5.63 8.312 3.69 9.455a.545.545 0 0 1-.555-.94l1.409-.83-1.626-.939a.547.547 0 0 1 .547-.946l1.625.938.014-1.634a.546.546 0 0 1 .546-.542h.005a.546.546 0 0 1 .541.551l-.02 2.252L9.1 9.055V5.677L7.14 4.569a.547.547 0 0 1 .537-.95l1.424.804V2.546A.546.546 0 0 1 9.646 2m6.512 6.515a.548.548 0 0 1 .052.906.55.55 0 0 1-.607.034l-1.496-.882 1.086-.628zm-2.52-3.953a.547.547 0 0 1 .552.542l.01 1.106-1.087.627-.015-1.724a.55.55 0 0 1 .156-.387.55.55 0 0 1 .385-.163"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="m2.297 15.246 15.407-8.895"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Snowflake01Off.displayName = 'Snowflake01Off';
