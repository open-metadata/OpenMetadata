import { Col, Row, Skeleton, Space } from 'antd';
import { uniqueId } from 'lodash';

const KnowledgePageDetailRightPanelSkeleton = () => {
  return (
    <div className="knowledge-page-right-panel">
      <Skeleton
        active
        avatar
        className="m-b-lg"
        paragraph={{ rows: 2 }}
        title={false}
      />

      <Row gutter={[0, 24]}>
        {Array.from({ length: 3 }).map(() => (
          <Col key={uniqueId()} span={24}>
            <Space direction="vertical">
              <Skeleton
                active
                paragraph={{ rows: 1, width: 100 }}
                title={false}
              />
              <Skeleton.Button active size="default" />
            </Space>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default KnowledgePageDetailRightPanelSkeleton;
