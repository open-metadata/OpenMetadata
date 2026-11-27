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

export const StackQuality: FC<Props> = ({
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
      d="m5.607 3.853-1.09.504C2.839 5.133 2 5.52 2 6.157s.839 1.024 2.517 1.8l1.09.504c1.056.488 1.584.732 2.145.732.562 0 1.09-.244 2.146-.732l1.09-.504c1.677-.776 2.516-1.163 2.516-1.8s-.839-1.024-2.517-1.8l-1.09-.504c-1.055-.488-1.583-.732-2.145-.732-.561 0-1.09.244-2.145.732M2.135 8.934A.7.7 0 0 0 2 9.339c0 .627.839 1.01 2.517 1.774l1.09.497c1.056.48 1.584.721 2.145.721h.308l.905-.258m.933 3.108c-1.056.481-1.584.722-2.146.722s-1.09-.24-2.145-.722l-1.09-.496C2.839 13.92 2 13.538 2 12.91c0-.25.133-.46.398-.672m15.033-2.175h-5.678a.57.57 0 0 0-.568.567v1.52a4.98 4.98 0 0 0 3.407 4.726A4.98 4.98 0 0 0 18 12.15v-1.52a.57.57 0 0 0-.568-.568"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m13.504 12.89.809.771 1.888-1.798"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
StackQuality.displayName = 'StackQuality';
