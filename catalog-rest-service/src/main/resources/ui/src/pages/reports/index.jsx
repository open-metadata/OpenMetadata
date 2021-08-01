import React from 'react';
import PageContainer from '../../components/containers/PageContainer';
import ReportCard from '../../components/reports/ReportCard';
import { mockData } from './index.mock';

const ReportsPage = () => {
  return (
    <PageContainer>
      <div className="container-fluid">
        <div className="row">
          <div className="col-sm-12">
            {mockData.map((reportDetails) => {
              return (
                <ReportCard
                  key={reportDetails.dataId}
                  reportDetails={reportDetails}
                />
              );
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default ReportsPage;
