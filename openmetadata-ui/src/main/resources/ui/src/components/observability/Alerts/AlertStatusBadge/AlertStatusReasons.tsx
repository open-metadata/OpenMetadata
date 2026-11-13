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

import { AlertStatusReasonSection } from './AlertStatusBadge.types';

/**
 * The reasons under the tooltip's title, one line each: the first section's reasons, then each
 * further section under its own heading.
 */
function AlertStatusReasons({
  sections,
}: Readonly<{ sections: AlertStatusReasonSection[] }>) {
  const [first, ...rest] = sections;

  return (
    <>
      {first.reasons.map((reason) => (
        <span
          className="tw:block"
          data-testid="alert-status-reason-line"
          key={reason}>
          {reason}
        </span>
      ))}
      {rest.map((section) => (
        <span className="tw:block tw:pt-2" key={section.title}>
          <span className="tw:block">{section.title}</span>
          {section.reasons.map((reason) => (
            <span
              className="tw:block"
              data-testid="alert-status-reason-line"
              key={reason}>
              {reason}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

export default AlertStatusReasons;
