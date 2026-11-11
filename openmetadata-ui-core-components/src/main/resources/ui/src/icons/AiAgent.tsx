/*
 *  Copyright 2026 Collate.
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

export const AiAgent: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M14.621 1.878h-4.566V.526a.52.52 0 0 0-.156-.372A.53.53 0 0 0 9.523 0H8.69a.53.53 0 0 0-.376.154.52.52 0 0 0-.155.372v1.352H3.59c-.952 0-1.865.375-2.539 1.041A3.54 3.54 0 0 0 0 5.432V7.55a8.74 8.74 0 0 0 2.6 6.212 8.92 8.92 0 0 0 6.277 2.573h.646a.54.54 0 0 0 .376-.154.52.52 0 0 0 .156-.372v-.826a.52.52 0 0 0-.156-.372.53.53 0 0 0-.376-.154h-.646a7.02 7.02 0 0 1-4.936-2.023A6.87 6.87 0 0 1 1.897 7.55V5.432c0-.445.179-.871.496-1.186a1.7 1.7 0 0 1 1.198-.49h11.03c.45 0 .88.176 1.198.49.318.315.496.741.496 1.186v2.266a6.4 6.4 0 0 1-.19 1.528.52.52 0 0 0 .35.627l.796.258a.53.53 0 0 0 .584-.175.5.5 0 0 0 .095-.192c.173-.668.26-1.356.262-2.046V5.432c0-.943-.379-1.846-1.052-2.513a3.6 3.6 0 0 0-2.539-1.041"
      fill="currentColor"
    />
    <path
      d="M6.07 9.763a1.51 1.51 0 0 0 1.518-1.502c0-.83-.68-1.502-1.517-1.502a1.51 1.51 0 0 0-1.518 1.502c0 .83.68 1.502 1.518 1.502m6.071 0a1.51 1.51 0 0 0 1.517-1.502c0-.83-.68-1.502-1.517-1.502a1.51 1.51 0 0 0-1.518 1.502c0 .83.68 1.502 1.518 1.502m6.019 5.407 1.719.67a.19.19 0 0 1 .12.175.19.19 0 0 1-.12.175l-1.719.67c-.304.12-.58.299-.812.528a2.4 2.4 0 0 0-.533.803l-.677 1.69a.19.19 0 0 1-.176.119.19.19 0 0 1-.177-.119l-.677-1.69a2.4 2.4 0 0 0-1.345-1.331l-1.708-.67a.19.19 0 0 1-.12-.175.19.19 0 0 1 .12-.174l1.708-.67a2.4 2.4 0 0 0 1.345-1.332l.677-1.69a.19.19 0 0 1 .353 0l.677 1.69a2.37 2.37 0 0 0 1.345 1.332"
      fill="currentColor"
    />
  </svg>
);
AiAgent.displayName = 'AiAgent';
