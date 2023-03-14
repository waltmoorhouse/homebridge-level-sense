import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';
import { Characteristic } from 'hap-nodejs/dist/lib/Characteristic';
import { Device } from './level-sense.types';
import { Service } from 'hap-nodejs/dist/lib/Service';
export declare class LevelSensePlatform implements DynamicPlatformPlugin {
    readonly log: Logging;
    private readonly config;
    private readonly api;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    private readonly SUPPORTED_DEVICES;
    private readonly levelSenseService;
    private readonly cachedAccessories;
    private readonly currentAccessories;
    constructor(log: Logging, config: PlatformConfig, api: API);
    discover(): Promise<void>;
    pollForNewData(): Promise<void>;
    getSensors(): Promise<Device[]>;
    private register;
    configureAccessory(accessory: PlatformAccessory): void;
    private updateDeviceReadings;
}
//# sourceMappingURL=dynamic-platform.d.ts.map