import React from "react";
import { Button, Card, Col, Row } from "antd";

const DemoComponent: React.FC = () => {
  return (
    <div className="site-card-wrapper p-sm">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="Demo Component">
            <p>This is a simple demo component using Ant Design.</p>
            <Button type="primary">Click Me</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Demo Component">
            <p>This is a simple demo component using Ant Design.</p>
            <Button type="primary">Click Me</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Demo Component">
            <p>This is a simple demo component using Ant Design.</p>
            <Button type="primary">Click Me</Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Demo Component">
            <p>This is a simple demo component using Ant Design.</p>
            <Button type="primary">Click Me</Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DemoComponent;
