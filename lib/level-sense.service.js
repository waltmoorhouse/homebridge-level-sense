"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelSenseService = void 0;
const axios_1 = __importDefault(require("axios"));
class LevelSenseService {
    constructor(config, log) {
        this.config = config;
        this.log = log;
        this.HOST = 'https://dash.level-sense.com/Level-Sense-API/web/api';
        this.borked = false;
    }
    async login() {
        if (this.config.sessionKey) {
            this.sessionId = this.config.sessionKey;
            this.log('A sessionKey was found in the config, skipping login attempt.');
            return;
        }
        const myHeaders = { 'Content-Type': 'application/json' };
        const raw = JSON.stringify({
            'email': this.config.email,
            'password': this.config.password
        });
        const requestOptions = {
            headers: myHeaders,
            data: raw,
        };
        this.log('Attempting to login and acquire sessionKey.');
        return axios_1.default.get(`${this.HOST}/v1/login`, requestOptions)
            .then(response => response.data)
            .then((result) => this.sessionId = result.sessionKey)
            .catch(error => {
            this.borked = true;
            this.log.error(error);
        });
    }
    async getDeviceList() {
        if (this.borked) {
            this.log.error("Something is not working, check your login credentials.");
            return Promise.resolve();
        }
        if (!this.sessionId) {
            await this.login();
        }
        const myHeaders = {
            'SESSIONKEY': this.sessionId,
            'Accept': 'application/json'
        };
        const requestOptions = {
            headers: myHeaders,
        };
        this.log('Attempting to get Device List.');
        return axios_1.default.get(`${this.HOST}/v1/getDeviceList`, requestOptions)
            .then(response => response.data)
            .catch(error => {
            this.sessionId = undefined;
            this.log.error(error);
        });
    }
    async getDeviceAlarm(deviceId) {
        if (this.borked) {
            this.log.error("Something is not working, check your login credentials.");
            return Promise.resolve();
        }
        if (!this.sessionId) {
            await this.login();
        }
        const myHeaders = {
            'SESSIONKEY': this.sessionId,
            'Content-Type': 'application/json'
        };
        const raw = {
            'id': deviceId
        };
        const requestOptions = {
            headers: myHeaders,
            data: raw
        };
        return axios_1.default.get(`${this.HOST}/v2/getAlarmConfig`, requestOptions)
            .then(response => response.data)
            .catch(error => {
            this.sessionId = undefined;
            this.log.error(error);
        });
    }
}
exports.LevelSenseService = LevelSenseService;
//# sourceMappingURL=level-sense.service.js.map