import PropTypes from 'prop-types';
import React from 'react';
import { Badge, Card } from 'react-bootstrap';

const IssueStats = ({ title, data }) => {
  return (
    <Card style={{ height: '200px' }}>
      <Card.Body>
        <Card.Title className="graphs-title">{title}</Card.Title>
        {data.map((issue) => (
          <Badge className="issue-type" key={issue.type} variant={issue.color}>
            <strong>{issue.value}</strong> {issue.type}
          </Badge>
        ))}
      </Card.Body>
    </Card>
  );
};

IssueStats.propTypes = {
  title: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number,
      name: PropTypes.string,
    })
  ),
};

export default IssueStats;
