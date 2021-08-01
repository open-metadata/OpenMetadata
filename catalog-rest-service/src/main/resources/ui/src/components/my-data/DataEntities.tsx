import PropTypes from 'prop-types';
import React from 'react';

type DataEntitiesProps = {
  data: { name: string; color: string; value: number };
  selectedEntity: Function;
};

const DataEntities: React.FC<DataEntitiesProps> = ({
  data,
  selectedEntity,
}) => {
  return (
    <div className="filter-group mb-2" style={{ color: `${data.color}` }}>
      <input
        className="mr-1"
        type="checkbox"
        onClick={(e) => {
          selectedEntity(e, data.name);
        }}
      />
      {data.name}
      <span
        className="ml-1"
        data-testid="team-size"
        style={{ color: '#5e5c58' }}>
        ({data.value})
      </span>
    </div>
  );
};

DataEntities.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
  }).isRequired,
  selectedEntity: PropTypes.func.isRequired,
};

export default DataEntities;
