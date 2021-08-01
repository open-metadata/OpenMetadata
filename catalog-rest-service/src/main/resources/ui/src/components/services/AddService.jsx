import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { Button, Col, Form } from 'react-bootstrap';

const AddServiceModal = ({ handleSave, serviceCollection }) => {
  const [selectedService, setSelectedService] = useState();
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    setSelectedService(serviceCollection.length && serviceCollection[0].value);
  }, [serviceCollection]);

  const handleSelect = ({ target: { value } }) => setSelectedService(value);

  const handleSubmit = (event) => {
    const form = event.currentTarget;
    const formData = new FormData(event.target),
      formDataObj = Object.fromEntries(formData.entries());
    if (form.checkValidity() === true) {
      handleSave(formDataObj, selectedService);
    }
    event.preventDefault();
    event.stopPropagation();

    setValidated(true);
  };

  return (
    <Form
      noValidate
      data-testid="form"
      validated={validated}
      onSubmit={handleSubmit}>
      <Form.Row>
        <Form.Group as={Col} md="12">
          <Form.Label>Select Service</Form.Label>
          <Form.Control as="select" onChange={handleSelect}>
            {serviceCollection.map((service, i) => {
              return <option key={i}>{service?.value}</option>;
            })}
          </Form.Control>
        </Form.Group>
      </Form.Row>
      <Form.Row>
        <Form.Group as={Col} md="6">
          <Form.Label>Service name</Form.Label>
          <Form.Control
            required
            name="name"
            placeholder="service name"
            type="text"
          />
        </Form.Group>
        <Form.Group as={Col} md="6">
          <Form.Label>Display name</Form.Label>
          <Form.Control
            required
            name="displayName"
            placeholder="display name"
            type="text"
          />
        </Form.Group>
      </Form.Row>
      <Form.Row>
        <Form.Group as={Col} md="12">
          <Form.Label>Description</Form.Label>
          <Form.Control
            required
            name="documentation"
            placeholder="description"
            type="text"
          />
        </Form.Group>
        <Form.Group as={Col} md="12">
          <Form.Label>Connection URL</Form.Label>
          <Form.Control required name="connectionUrl" type="text" />
        </Form.Group>
      </Form.Row>

      <Button className="add-service" type="submit">
        Add
      </Button>
    </Form>
  );
};

AddServiceModal.propTypes = {
  handleSave: PropTypes.func.isRequired,
  serviceCollection: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.string,
    })
  ),
};

export default AddServiceModal;
