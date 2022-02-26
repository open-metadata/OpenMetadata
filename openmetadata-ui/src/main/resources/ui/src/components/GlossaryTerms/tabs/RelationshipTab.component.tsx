import classNames from 'classnames';
import React from 'react';

const RelationshipTab = () => {
  const data = [
    {
      relationship: 'Contains',
      relatedTerms: 'Shirts',
    },
    {
      relationship: 'Contains',
      relatedTerms: 'Jeans',
    },
    {
      relationship: 'Contains',
      relatedTerms: 'Shoes',
    },
    {
      relationship: 'Contains',
      relatedTerms: 'Caps',
    },
  ];

  return (
    <div className="tw-table-responsive" id="relationship">
      <table className="tw-w-full tw-bg-white">
        <thead>
          <tr className="tableHead-row">
            <th className="tableHead-cell">Relationship</th>
            <th className="tableHead-cell">Related Terms</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            return (
              <tr className={classNames('tableBody-row')} key={index}>
                <td
                  className={classNames(
                    'tableBody-cell tw-group tw-relative tw-align-baseline'
                  )}>
                  {row.relationship}
                </td>
                <td
                  className={classNames(
                    'tableBody-cell tw-group tw-relative tw-align-baseline'
                  )}>
                  {row.relatedTerms}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RelationshipTab;
