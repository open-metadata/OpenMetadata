import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './pages/LandingPage.component';
import ServicesPage from './pages/ServicesPage';
import AddServicePage from './pages/AddServicePage.component';
import AddIngestionPage from './pages/AddIngestionPage.component';

axios.defaults.baseURL = 'http://localhost:8001/';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={LandingPage} exact />
        <Route path="/service" component={ServicesPage} />
        <Route path="/databaseServices/add-service" component={AddServicePage} />
        <Route path="/addIngestion" component={AddIngestionPage} />
        {/* <Route path="/services" element={<Services />} />
        <Route path="/add-service" element={<AddService />} />
        <Route path="/config-service" element={<ConfigureService />} /> */}
      </Switch>
    </Router>
  );
}

export default App;