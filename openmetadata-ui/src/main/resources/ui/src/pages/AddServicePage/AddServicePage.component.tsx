import React from 'react';
import { useParams } from 'react-router-dom';
import AddService from '../../components/AddService/AddService.component';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { ServiceCategory } from '../../enums/service.enum';

const AddServicePage = () => {
  const { serviceCategory } = useParams<{ [key: string]: string }>();

  return (
    <PageContainerV1>
      <AddService serviceCategory={serviceCategory as ServiceCategory} />
    </PageContainerV1>
  );
};

export default AddServicePage;
