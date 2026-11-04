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

export const DefaultAppMode: FC<Props> = ({
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
      d="M2 13.199c0 1.769 0 2.653.561 3.243q.136.142.296.261c.67.496 1.672.496 3.676.496h.533c2.005 0 3.007 0 3.676-.496q.16-.119.296-.26c.562-.591.562-1.475.562-3.244s0-2.653-.562-3.243a2.3 2.3 0 0 0-.296-.261c-.669-.496-1.671-.496-3.676-.496h-.533c-2.004 0-3.007 0-3.676.496q-.16.119-.296.26C2 10.547 2 11.43 2 13.2m6.4-6.403c0-1.769 0-2.653.562-3.244q.135-.141.296-.26c.669-.496 1.671-.496 3.676-.496h.533c2.004 0 3.007 0 3.676.495q.161.12.295.261C18 4.143 18 5.028 18 6.797c0 1.768 0 2.653-.562 3.243q-.135.143-.295.261c-.607.45-1.488.491-3.143.495M2 12.395h9.6M8.4 5.996H18M2 7.597a4.8 4.8 0 0 1 4.026-4.738c.22-.036.331-.054.421-.005.073.04.135.125.151.206.02.1-.035.21-.146.432l-.338.676M18 12.395a4.8 4.8 0 0 1-4.025 4.738c-.221.035-.331.053-.421.004a.32.32 0 0 1-.151-.206c-.02-.1.035-.21.146-.431l.338-.677"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DefaultAppMode.displayName = 'DefaultAppMode';
