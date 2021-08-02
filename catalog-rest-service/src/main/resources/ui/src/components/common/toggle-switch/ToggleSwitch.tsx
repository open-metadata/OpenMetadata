/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import PropTypes from 'prop-types';
import React from 'react';
type ToggleSwitchProps = {
  label: string;
  onToggle: React.ChangeEventHandler<HTMLInputElement>;
  isEnabled: boolean;
};
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  onToggle,
  isEnabled,
}) => {
  return (
    <div className="toggle-container" data-testid="toggle-container">
      <div className="toggle-label" data-testid="toggle-label">
        {label}
      </div>
      <label className="toggle-switch">
        <input
          checked={isEnabled}
          className="toggle-checkbox"
          data-testid="toggle-checkbox"
          type="checkbox"
          onChange={onToggle}
        />
        <span className="toggle-slider toggle-round" />
      </label>
    </div>
  );
};

ToggleSwitch.defaultProps = {
  isEnabled: false,
};

ToggleSwitch.propTypes = {
  label: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
  isEnabled: PropTypes.bool.isRequired,
};

export default ToggleSwitch;
