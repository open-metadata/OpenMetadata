import { Col, Row, Skeleton } from 'antd';

const KnowledgePageDetailSkeleton = () => {
  return (
    <Row className="knowledge-page-layout-grid">
      <Col span={24}>
        <Row wrap={false}>
          <Col className="knowledge-page-layout-content" flex="auto">
            <div className="content-container m-b-md">
              <Skeleton.Input active block className="rounded-4" size="large" />
              <Skeleton
                active
                className="m-t-sm"
                paragraph={{ rows: 10 }}
                title={false}
              />
            </div>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default KnowledgePageDetailSkeleton;
