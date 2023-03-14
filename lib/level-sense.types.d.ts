export type LevelSenseServiceConfigOptions = {
    email: string;
    password: string;
    sessionKey?: string;
};
export type AccessoryContext = {
    device: Device;
    readings: DeviceAlarm;
};
export type LoginResult = {
    success: boolean;
    message: string;
    sessionKey: string;
};
export type GetDevices = {
    success: boolean;
    deviceList: Device[];
    errorId: string;
    message: string;
};
export type Device = {
    id: string;
    deviceType: string;
    checkinFailCount: string;
    deviceSerialNumber: string;
    displayName: string;
    pumpCalibrateCycles: string;
    pumpCalibrateSum: string;
    pumpCalibrateMinSum: string;
    capSenseMinOffset: string;
    capSenseMax: string;
    deviceState: string;
    relayState: string;
    sirenState: string;
    alarmSilence: string;
    messageSendDate: string;
    deviceFirmware: string;
    alarmSent: string;
    online: string;
};
export type DeviceAlarmResponse = {
    success: boolean;
    errorId: string;
    message: string;
    device: DeviceAlarm;
};
export type DeviceAlarm = {
    id: string;
    displayName: string;
    deviceSerialNumber: string;
    deviceType: string;
    supportedSensors: string[];
    pumpCycle: 0;
    sensorLimit: AlarmConfig[];
    sensorLimitMeta: {
        cap_sense: string;
        tempc: {
            displayUnitList: LabeledStringValue[];
            min: StringSelectValue[];
            max: StringSelectValue[];
        };
        rh: {
            min: NumericSelectValue[];
            max: NumericSelectValue[];
        };
        input1: LabeledNumericValue[];
        input2: LabeledNumericValue[];
    };
    deviceConfig: IdConfigValue[];
    deviceConfigMeta: {
        delayList: LabeledNumericValue[];
    };
};
export type AlarmConfig = {
    id: string;
    sensorId: string;
    sensorSlug: string;
    sensorDisplayName: string;
    sensorDisplayUnits: string;
    lcl: number;
    ucl: number;
    enabled: number;
    relay: number;
    siren: number;
    email: number;
    text: number;
    voice: number;
    isAlarm: boolean;
    currentValue: string;
};
export type IdConfigValue = {
    id: string;
    configKey: string;
    configVal: string;
};
export type StringSelectValue = {
    label: string;
    value: string;
    selected: boolean;
};
export type NumericSelectValue = {
    label: number;
    value: number;
    selected: boolean;
};
export type LabeledNumericValue = {
    value: number;
    label: string;
};
export type LabeledStringValue = {
    value: string;
    label: string;
};
//# sourceMappingURL=level-sense.types.d.ts.map