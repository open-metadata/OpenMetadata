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

export const Report: FC<Props> = ({
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
      d="M16.25 12.16V8.766c0-.64 0-.959-.12-1.246-.119-.287-.344-.513-.796-.965l-3.7-3.702c-.39-.39-.585-.585-.826-.7a2 2 0 0 0-.154-.064C10.4 2 10.126 2 9.574 2c-2.535 0-3.802 0-4.66.692q-.261.21-.472.472c-.692.859-.692 2.127-.692 4.663v3.551c0 2.948 0 4.421.915 5.337.737.737 1.835.88 3.772.909M10.781 2.39v.39c0 2.211 0 3.316.686 4.003.687.687 1.791.687 4 .687h.391"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m15.584 18-1.093-1.093m.364-1.822a2.186 2.186 0 1 1-4.373 0 2.186 2.186 0 0 1 4.373 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Report.displayName = 'Report';
