export type LevelSenseServiceConfigOptions = {
  email: string
  password: string
  sessionKey?: string
}

export type AccessoryContext = {
  device: Device
  readings: DeviceAlarm
  version: string
}

export type LoginResult = {
  success: boolean
  message: string
  sessionKey: string
}

export type GetDevices = {
  success: boolean
  deviceList: Device[]
  errorId: string
  message: string
}

export type Device = {
  id: string //11018,
  deviceType: string //LS_SENTRY,
  checkinFailCount: string //3,
  deviceSerialNumber: string //bs4rkpnoett3na7n031e,
  displayName: string //Steak Locker,
  pumpCalibrateCycles: string //0,
  pumpCalibrateSum: string //0,
  pumpCalibrateMinSum: string //0,
  capSenseMinOffset: string //0,
  capSenseMax: string //0,
  deviceState: string //0,
  relayState: string //0,
  sirenState: string //0,
  alarmSilence: string //0,
  messageSendDate: string //0,
  deviceFirmware: string //SENTRY_011922B,
  alarmSent: string //0,
  online: string //0
}

export type DeviceAlarmResponse = {
  success: boolean
  errorId: string
  message: string
  device: DeviceAlarm
}

export type DeviceAlarm = {
  id: string
  displayName: string
  deviceSerialNumber: string,
  deviceType: string
  supportedSensors: string[],
  pumpCycle: 0,
  sensorLimit: AlarmConfig[],
  sensorLimitMeta: {
    cap_sense: string,
    tempc: {
      displayUnitList: LabeledStringValue[],
      min: StringSelectValue[],
      max: StringSelectValue[]
    },
    rh: {
      min: NumericSelectValue[],
      max: NumericSelectValue[]
    },
    input1: LabeledNumericValue[],
    input2: LabeledNumericValue[]
  },
  deviceConfig: IdConfigValue[],
  deviceConfigMeta: {
    delayList: LabeledNumericValue[]
  }
}

export type AlarmConfig = {
  id: string
  sensorId: string,
  sensorSlug: string,
  sensorDisplayName: string,
  sensorDisplayUnits: string,
  lcl: number,
  ucl: number,
  enabled: number,
  relay: number,
  siren: number,
  email: number,
  text: number,
  voice: number,
  isAlarm: boolean,
  currentValue: string
}

export type IdConfigValue = {
  id: string
  configKey: string
  configVal: string
}

export type StringSelectValue = {
  label: string
  value: string
  selected: boolean
}

export type NumericSelectValue = {
  label: number
  value: number
  selected: boolean
}

export type LabeledNumericValue = {
  value: number
  label: string
}

export type LabeledStringValue = {
  value: string
  label: string
}
