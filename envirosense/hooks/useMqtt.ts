"use client";

import { useEffect, useState, useRef } from 'react';
import mqtt from 'mqtt';

// Public HiveMQ WebSocket URL
const MQTT_URL = "wss://broker.hivemq.com:8884/mqtt";

export function useMqtt() {
  const [connected, setConnected] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    online: false,
    uptime: 0,
    ip: '',
    mac: '',
    rssi: 0,
    version: '',
  });
  const [sensorValues, setSensorValues] = useState({
    co2: "N/A",
    co: "N/A",
    voc: "N/A",
    pm25: "N/A",
    temp: "N/A",
    pressure: "N/A",
  });

  const clientRef = useRef(null);

  useEffect(() => {
    const clientId = `envirosense-web-${Math.random().toString(16).slice(2, 10)}`;
    const client = mqtt.connect(MQTT_URL, { clientId, clean: true });
    clientRef.current = client;

    client.on('connect', () => {
      console.log('Web MQTT Connected');
      setConnected(true);
      // Subscribe to all necessary topics
      client.subscribe('envirosense/heartbeat');
      client.subscribe('envirosense/co2');
      client.subscribe('envirosense/co');
      client.subscribe('envirosense/voc');
      client.subscribe('envirosense/dust');
      client.subscribe('envirosense/temperature');
      client.subscribe('envirosense/pressure');
    });

    client.on('message', (topic, message) => {
      const payload = message.toString();
      try {
        const data = JSON.parse(payload);

        // Heartbeat updates device status
        if (topic === 'envirosense/heartbeat') {
          setDeviceStatus({
            online: true,
            uptime: data.uptime || 0,
            ip: data.ip || '',
            mac: data.mac || '',
            rssi: data.rssi || 0,
            version: data.version || '',
          });
        }

        // Sensor topics update the corresponding value
        const topicMap = {
          'envirosense/co2': 'co2',
          'envirosense/co': 'co',
          'envirosense/voc': 'voc',
          'envirosense/dust': 'pm25',
          'envirosense/temperature': 'temp',
          'envirosense/pressure': 'pressure',
        };
        const key = topicMap[topic];
        if (key && data && typeof data.value === 'number') {
          setSensorValues(prev => ({ ...prev, [key]: data.value }));
        }
      } catch (e) {
        console.error('Error parsing MQTT message', e);
      }
    });

    client.on('offline', () => setConnected(false));
    client.on('error', (err) => {
      console.error('MQTT error', err);
      setConnected(false);
    });

    return () => {
      client.end();
    };
  }, []);

  // Publish a wake command to the OLED display
  const wakeDisplay = (sensorId) => {
    if (!clientRef.current || !connected) return;
    const command = {
      action: 'wake',
      sensor: sensorId || 'all',
      screen: sensorId ? getScreenIndex(sensorId) : -1,
      timestamp: Date.now(),
    };
    clientRef.current.publish('envirosense/display/command', JSON.stringify(command));
  };

  return { connected, deviceStatus, sensorValues, wakeDisplay };
}

// Helper to map sensor IDs to screen indices (matching Arduino's SCREEN_COUNT order)
function getScreenIndex(sensorId) {
  const map = {
    temp: 0, pressure: 1, pm25: 2, co2: 3, co: 4, voc: 5,
  };
  return map[sensorId] || 0;
}