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
