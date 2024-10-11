import { Row, Col, Tabs } from "antd";
import TitleBreadcrumb from "../components/common/TitleBreadcrumb/TitleBreadcrumb.component";
import PageLayoutV1 from "../components/PageLayoutV1/PageLayoutV1";
import React from "react";
import { PAGE_HEADERS } from "../constants/PageHeaders.constant";
import IngestionOptions from "../components/Settings/Services/IngestionOptions/IngestionOptions";

const IngestionOptionsPage = () => {
    return (
        <PageLayoutV1 pageTitle={PAGE_HEADERS.INGESTION_OPTIONS.header}>
            <Row className="page-container" gutter={[0, 16]}>
                <Col span={24}>
                    <TitleBreadcrumb titleLinks={[]} />
                </Col>
                <Col span={24}>
                    <IngestionOptions />
                </Col>
            </Row >
        </PageLayoutV1 >
    );
}

export default IngestionOptionsPage;