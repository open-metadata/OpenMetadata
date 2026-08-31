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
import type { FC, SVGProps } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const NoFilterFunnel: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => <svg aria-hidden="true" fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 20 20" width={size} {...props}><path d="M17.999 3.333c-.01-.386-.092-.663-.29-.882C17.298 2 16.573 2 15.124 2H4.875c-1.45 0-2.174 0-2.583.451s-.32 1.15-.14 2.547c.052.408.14.64.406.956.86 1.023 2.437 2.842 4.649 4.496a.93.93 0 0 1 .357.671 175 175 0 0 0 .598 6.148c.064.537.66.95 1.15.603.824-.583 2.364-1.236 2.567-2.322.075-.4.178-1.034.294-1.994m5.828-8.006-5.333 5.334m5.333 0-5.333-5.333" stroke="currentColor" strokeWidth={1.3} /></svg>;
NoFilterFunnel.displayName = "NoFilterFunnel";