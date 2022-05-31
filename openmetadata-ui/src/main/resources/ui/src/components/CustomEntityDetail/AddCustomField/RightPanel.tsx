/*
 *  Copyright 2021 Collate
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

import React, { Fragment } from 'react';

export const RightPanel = () => {
  return (
    <Fragment>
      <h6 className="tw-heading tw-text-base" data-testid="header">
        Add a Custom Field
      </h6>
      <div className="tw-mb-5" data-testid="body">
        OpenMetadata supports custom fields in the Table entity. Create a custom
        field by adding a unique field name. The name must start with a
        lowercase letter, as preferred in the camelCase format. Uppercase
        letters and numbers can be included in the field name; but spaces,
        underscores, and dots are not supported. Select the preferred field Type
        from among the options provided. Describe your custom field to provide
        more information to your team.
      </div>
    </Fragment>
  );
};
