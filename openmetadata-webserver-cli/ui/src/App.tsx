import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './pages/LandingPage.component';
import ServicesPage from './pages/ServicesPage';

axios.defaults.baseURL = 'http://localhost:8001/api';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/" component={ServicesPage} />
        {/* <Route path="/services" element={<Services />} />
        <Route path="/add-service" element={<AddService />} />
        <Route path="/config-service" element={<ConfigureService />} /> */}
      </Switch>
    </Router>
  );
}

export default App;