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

export const ClipboardCheck: FC<Props> = ({
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
      d="M13.202 3.6c.743 0 1.116 0 1.42.082a2.4 2.4 0 0 1 1.698 1.697c.082.305.082.677.082 1.421v7.36c0 1.344 0 2.016-.262 2.53a2.4 2.4 0 0 1-1.049 1.048c-.513.262-1.185.262-2.53.262h-5.12c-1.344 0-2.016 0-2.529-.262a2.4 2.4 0 0 1-1.049-1.048c-.261-.514-.261-1.186-.261-2.53V6.8c0-.744 0-1.116.081-1.421A2.4 2.4 0 0 1 5.38 3.682c.306-.082.678-.082 1.422-.082m.8 8.8 1.6 1.6 3.6-3.6m-4.72-5.2h3.84c.448 0 .672 0 .843-.087a.8.8 0 0 0 .35-.35c.087-.17.087-.395.087-.843v-.64c0-.448 0-.672-.088-.843a.8.8 0 0 0-.35-.35C12.595 2 12.37 2 11.923 2h-3.84c-.448 0-.673 0-.844.087a.8.8 0 0 0-.35.35c-.086.17-.086.395-.086.843v.64c0 .448 0 .672.087.843a.8.8 0 0 0 .35.35c.17.087.395.087.843.087"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ClipboardCheck.displayName = 'ClipboardCheck';
