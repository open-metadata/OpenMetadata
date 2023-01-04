/*
 *  Copyright 2022 Collate.
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
        Add a Custom Property
      </h6>
      <div className="tw-mb-5" data-testid="body">
        OpenMetadata supports custom properties in the Table entity. Create a
        custom property by adding a unique property name. The name must start
        with a lowercase letter, as preferred in the camelCase format. Uppercase
        letters and numbers can be included in the field name; but spaces,
        underscores, and dots are not supported. Select the preferred property
        Type from among the options provided. Describe your custom property to
        provide more information to your team.
      </div>
    </Fragment>
  );
};
