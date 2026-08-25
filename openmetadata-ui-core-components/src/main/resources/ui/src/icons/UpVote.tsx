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

export const UpVote: FC<Props> = ({
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
      d="M2 10.4a1.6 1.6 0 0 1 1.6-1.6A2.4 2.4 0 0 1 6 11.202v3.2a2.4 2.4 0 0 1-2.4 2.4 1.6 1.6 0 0 1-1.6-1.6z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m12.78 6.645-.213.688c-.175.564-.262.845-.195 1.068.055.18.174.336.336.438.201.126.505.126 1.113.126h.323c2.056 0 3.085 0 3.57.609q.084.105.148.22c.373.68-.051 1.594-.9 3.423-.78 1.678-1.17 2.518-1.894 3.012q-.105.071-.216.135c-.762.436-1.706.436-3.594.436h-.41c-2.287 0-3.43 0-4.141-.688s-.71-1.797-.71-4.013v-.779c0-1.164 0-1.747.206-2.28.207-.533.602-.971 1.394-1.847l3.274-3.625c.082-.091.123-.137.159-.168a.827.827 0 0 1 1.155.073 9 9 0 0 1 .345.5 3.05 3.05 0 0 1 .356 2.312c-.022.088-.05.179-.106.36"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
UpVote.displayName = 'UpVote';
