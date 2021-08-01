import PropTypes from 'prop-types';
import React from 'react';

const Tiers = ({ tier, selectedTier }) => {
  return (
    <div className="filter-group mb-2">
      <input
        className="mr-1"
        type="checkbox"
        onClick={(e) => {
          selectedTier(e, tier);
        }}
      />
      {tier}
    </div>
  );
};

Tiers.propTypes = {
  tier: PropTypes.string,
  selectedTier: PropTypes.func,
};

export default Tiers;
