import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
// import axios from 'axios';

const LandingPage: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [ingestionToken, setIngestionToken] = useState('');
  const history = useHistory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // const response = await axios.post('/create-ingestion', {
      //   server_url: serverUrl,
      //   ingestion_token: ingestionToken,
      // });
      // console.log(response.data);
      history.push('/services'); // Redirect to Services page
    } catch (error) {
      console.error('Error creating ingestion:', error);
    }
  };

  return (
    <div style={styles.container}>
      {/* Logo Placeholder */}
      <div style={styles.logoContainer}>
        <div style={styles.logo}>logo</div>
      </div>

      {/* Title */}
      <h1 style={styles.title}>OpenMetadata Ingestion Server</h1>

      {/* Info Box */}
      <div style={styles.infoBox}>
        <p>Welcome to the Ingestion Server!<br />
          Here you can easily prepare the configurations to start ingesting metadata externally!
        </p>
        <p>In order to move on, please provide the following information:</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Server URL</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Ingestion Bot Token</label>
          <input
            type="text"
            value={ingestionToken}
            onChange={(e) => setIngestionToken(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        {/* CTA Button */}
        <button type="submit" style={styles.ctaButton}>
          Create an Ingestion
        </button>
      </form>
    </div>
  );
};

// Inline CSS styles for the component
const styles = {
  container: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    textAlign: 'center' as 'center',
    border: '1px solid #000',
    borderRadius: '10px',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  logo: {
    width: '50px',
    height: '50px',
    backgroundColor: '#f0f0f0',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold' as 'bold',
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
  },
  infoBox: {
    padding: '15px',
    marginBottom: '20px',
    backgroundColor: '#f9f9f9',
    border: '1px solid #ddd',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'flex-start' as 'flex-start',
    gap: '8px',
  },
  label: {
    fontSize: '16px',
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '16px',
    borderRadius: '4px',
    border: '1px solid #ccc',
  },
  ctaButton: {
    padding: '10px 20px',
    fontSize: '18px',
    backgroundColor: '#007BFF',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
};

export default LandingPage;