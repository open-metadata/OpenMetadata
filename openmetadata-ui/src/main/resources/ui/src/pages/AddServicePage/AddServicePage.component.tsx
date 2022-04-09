import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import AddIngestion from '../../components/AddIngestion/AddIngestion.component';
import AddService from '../../components/AddService/AddService.component';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { ServiceCategory } from '../../enums/service.enum';
import { DataObj } from '../../interface/service.interface';

const AddServicePage = () => {
  const { serviceCategory } = useParams<{ [key: string]: string }>();
  const [addIngestion, setAddIngestion] = useState(true);
  const [serviceData, setServiceData] = useState<DataObj>({
    name: 'ServiceName',
  } as DataObj);

  const onSave = (service: DataObj) => {
    setServiceData(service);
  };

  const handleAddIngestion = () => {
    setAddIngestion(true);
  };

  return (
    <PageContainerV1>
      {addIngestion ? (
        <AddIngestion serviceData={serviceData as DataObj} />
      ) : (
        <AddService
          handleAddIngestion={handleAddIngestion}
          serviceCategory={serviceCategory as ServiceCategory}
          onSave={onSave}
        />
      )}
    </PageContainerV1>
  );
};

export default AddServicePage;
