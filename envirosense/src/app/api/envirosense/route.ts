import { NextResponse } from 'next/server';
import mqtt from 'mqtt';

// MQTT Configuration
const MQTT_URL = process.env.MQTT_BROKER_URL || "wss://broker.hivemq.com:8884/mqtt";
let mqttClient: any = null;

// In-memory store for device status
let deviceStatus = {
  online: false,
  lastHeartbeat: null as number | null,
  uptime: 0,
  ip: '',
  mac: '',
  rssi: 0,
  version: '',
};

// Store last known sensor values (aligned with Arduino)
let lastSensorValues = {
  co2: 412,      // Arduino: MQ135 baseline
  co: 0.8,       // Arduino: CO in ppm
  voc: 0.5,      // Arduino: VOC in ppm
  pm25: 50,      // Arduino: Dust density µg/m³
  temp: 28.5,    // Arduino: Temperature °C
  pressure: 1013.2 // Arduino: Pressure hPa
};

// Initialize MQTT connection
function initMQTT() {
  if (mqttClient) return;

  try {
    mqttClient = mqtt.connect(MQTT_URL, {
      clientId: `envirosense-api-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });

    mqttClient.on('connect', () => {
      console.log('API MQTT Connected');
      mqttClient.subscribe('envirosense/heartbeat');
      mqttClient.subscribe('envirosense/#');
    });

    mqttClient.on('message', (topic: string, message: Buffer) => {
      const payload = message.toString();

      // Update device status from heartbeat
      if (topic === 'envirosense/heartbeat') {
        try {
          const hb = JSON.parse(payload);
          deviceStatus = {
            online: true,
            lastHeartbeat: Date.now(),
            uptime: hb.uptime || 0,
            ip: hb.ip || '',
            mac: hb.mac || '',
            rssi: hb.rssi || 0,
            version: hb.version || '',
          };
        } catch (e) {
          console.error('Failed to parse heartbeat:', e);
        }
      }

      // Update sensor values (aligned with Arduino topics)
      const topicMap: Record<string, string> = {
        'envirosense/co2': 'co2',
        'envirosense/co': 'co',
        'envirosense/voc': 'voc',
        'envirosense/dust': 'pm25',
        'envirosense/temperature': 'temp',
        'envirosense/pressure': 'pressure'
      };

      const sensorKey = topicMap[topic];
      if (sensorKey) {
        try {
          const data = JSON.parse(payload);
          if (data && typeof data.value === 'number') {
            lastSensorValues[sensorKey] = data.value;
          }
        } catch (e) {
          console.error('Failed to parse sensor JSON', e);
        }
      }
    });

    mqttClient.on('offline', () => {
      deviceStatus.online = false;
    });

    mqttClient.on('error', (error: Error) => {
      console.error('MQTT Error:', error);
      deviceStatus.online = false;
    });
  } catch (error) {
    console.error('Failed to initialize MQTT:', error);
  }
}

// Initialize on module load
initMQTT();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Get device status
  if (action === 'status') {
    // Check for stale device (no heartbeat for 30 seconds)
    if (deviceStatus.lastHeartbeat && Date.now() - deviceStatus.lastHeartbeat > 30000) {
      deviceStatus.online = false;
    }

    return NextResponse.json({
      success: true,
      data: deviceStatus
    });
  }

  // Get all sensor data
  if (action === 'sensors') {
    return NextResponse.json({
      success: true,
      data: lastSensorValues
    });
  }

  return NextResponse.json({
    success: false,
    error: 'Invalid action'
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sensorId } = body;

    if (!mqttClient) {
      return NextResponse.json({
        success: false,
        error: 'MQTT not connected'
      });
    }

    // Wake up OLED and show specific sensor
    if (action === 'wakeDisplay') {
      const command = {
        action: 'wake',
        sensor: sensorId || 'all',
        screen: sensorId ? getScreenIndex(sensorId) : -1,
        timestamp: Date.now()
      };

      mqttClient.publish('envirosense/display/command', JSON.stringify(command));

      return NextResponse.json({
        success: true,
        message: `Display wake command sent${sensorId ? ` for ${sensorId}` : ''}`
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid request body'
    });
  }
}

// Helper to map sensor IDs to screen indices (matching Arduino's SCREEN_COUNT order)
function getScreenIndex(sensorId: string): number {
  const screenMap: Record<string, number> = {
    'temp': 0,
    'pressure': 1,
    'pm25': 2,
    'co2': 3,
    'co': 4,
    'voc': 5
  };
  return screenMap[sensorId] || 0;
}