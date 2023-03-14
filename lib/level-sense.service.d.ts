import { Logging } from 'homebridge';
import { DeviceAlarmResponse, GetDevices, LevelSenseServiceConfigOptions } from './level-sense.types';
export declare class LevelSenseService {
    private readonly config;
    private readonly log;
    private readonly HOST;
    private borked;
    constructor(config: LevelSenseServiceConfigOptions, log: Logging);
    private sessionId;
    login(): Promise<string | void>;
    getDeviceList(): Promise<GetDevices | void>;
    getDeviceAlarm(deviceId: string): Promise<DeviceAlarmResponse | void>;
}
//# sourceMappingURL=level-sense.service.d.ts.map