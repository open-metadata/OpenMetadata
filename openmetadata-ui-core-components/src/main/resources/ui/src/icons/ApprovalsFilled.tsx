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

export const ApprovalsFilled: FC<Props> = ({
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
      d="M2 9.36c0-.895 0-1.343.174-1.686a1.6 1.6 0 0 1 .7-.699c.342-.174.79-.174 1.686-.174h6.08c.896 0 1.344 0 1.686.174a1.6 1.6 0 0 1 .7.7c.174.342.174.79.174 1.686v6.08c0 .896 0 1.344-.174 1.686a1.6 1.6 0 0 1-.7.7c-.342.174-.79.174-1.686.174H4.56c-.896 0-1.344 0-1.686-.175a1.6 1.6 0 0 1-.7-.699C2 16.785 2 16.337 2 15.441z"
      fill="currentColor"
    />
    <path
      d="M6.8 6.8V4.56c0-.896 0-1.344.174-1.686a1.6 1.6 0 0 1 .7-.7C8.016 2 8.464 2 9.36 2h6.08c.896 0 1.344 0 1.686.174a1.6 1.6 0 0 1 .7.7c.174.342.174.79.174 1.686v6.08c0 .896 0 1.344-.174 1.686a1.6 1.6 0 0 1-.7.7c-.342.174-.79.174-1.686.174H13.2M6.8 6.8h3.84c.896 0 1.344 0 1.686.174a1.6 1.6 0 0 1 .7.7c.174.342.174.79.174 1.686v3.84M6.8 6.8H4.56c-.896 0-1.344 0-1.686.174a1.6 1.6 0 0 0-.7.7C2 8.016 2 8.464 2 9.36v6.08c0 .896 0 1.344.174 1.686a1.6 1.6 0 0 0 .7.7c.342.174.79.174 1.686.174h6.08c.896 0 1.344 0 1.686-.174a1.6 1.6 0 0 0 .7-.7c.174-.342.174-.79.174-1.686V13.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:stroke-bg-primary"
      d="m5.2 12.398 1.6 1.6 3.6-3.6"
      stroke="#fff"
      strokeWidth={1.3}
    />
  </svg>
);
ApprovalsFilled.displayName = 'ApprovalsFilled';
