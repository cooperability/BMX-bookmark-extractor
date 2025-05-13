'use client'; // Add this directive for client-side hooks

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface HealthStatus {
  status: string;
  version: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        // Use the Docker service name 'backend' and its port 8000
        // This requires the browser to be able to resolve 'backend',
        // typically meaning both containers are on the same Docker network.
        // For local development access from YOUR browser, you'd use localhost:8000,
        // but for container-to-container, use the service name.
        // However, fetch runs in the *user's browser*, not the frontend container.
        // So we need to call the backend as exposed on localhost.
        const response = await fetch('http://localhost:8000/health');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: HealthStatus = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching health status:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch health status');
        setHealth(null);
      }
    };

    fetchHealth();
    const intervalId = setInterval(fetchHealth, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, []);

  return (
    <main className={styles.main}>
      <h1>BMX Health Check (Next.js Frontend)</h1>
      <div id="health-status">
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {health ? (
          <>
            <p>Status: <span style={{ color: health.status === 'healthy' ? 'green' : 'red' }}>{health.status}</span></p>
            <p>Backend Version: {health.version}</p>
          </>
        ) : (
          !error && <p>Loading...</p>
        )}
      </div>
    </main>
  );
}
