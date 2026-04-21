import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

export interface SensorReading {
  timestamp: number;
  voltage: number;
  current: number;
  power: number;
  temperature: number;
  humidity: number;
}

interface SensorDataState {
  currentReading: SensorReading | null;
  historicalData: SensorReading[];
  loading: boolean;
  error: string | null;
}

export const useSensorData = (sensorId: string) => {
  const [state, setState] = useState<SensorDataState>({
    currentReading: null,
    historicalData: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!sensorId) {
      setState({
        currentReading: null,
        historicalData: [],
        loading: false,
        error: 'No sensor selected',
      });
      return;
    }

    const dataRef = ref(database, `sensors/${sensorId}/readings`);

    const onValueCallback = (snapshot: any) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const readings = Object.values(data as Record<string, any>).sort(
            (a: any, b: any) => a.timestamp - b.timestamp
          );
          
          setState({
            currentReading: readings[readings.length - 1] as SensorReading,
            historicalData: readings as SensorReading[],
            loading: false,
            error: null,
          });
        } else {
          setState({
            currentReading: null,
            historicalData: [],
            loading: false,
            error: null,
          });
        }
      } catch (err: any) {
        setState({
          currentReading: null,
          historicalData: [],
          loading: false,
          error: err.message || 'Failed to fetch sensor data',
        });
      }
    };

    onValue(dataRef, onValueCallback);

    return () => {
      off(dataRef);
    };
  }, [sensorId]);

  return state;
};
