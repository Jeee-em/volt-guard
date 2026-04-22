export interface SensorReading {
    timestamp: string;
    voltage: number;
    current: number;
    power: number;
}

export const generateMockData = (count: number = 300): SensorReading[] => {
    const data: SensorReading[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const time = new Date(now.getTime() - (count - i) * 5 * 60000); // 5-minute intervals

        // Simulate realistic electrical fluctuations
        const baseVoltage = 220;
        const voltage = baseVoltage + (Math.random() * 4 - 2); // 218V - 222V
        const current = 4 + (Math.random() * 3); // 4A - 7A
        const power = voltage * current;

        data.push({
            timestamp: time.toISOString(),
            voltage,
            current,
            power,
        });
    }

    return data;
};

export const MOCK_HISTORICAL_DATA = generateMockData();
export const MOCK_CURRENT_READING = MOCK_HISTORICAL_DATA[MOCK_HISTORICAL_DATA.length - 1];