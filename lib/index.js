"use strict";
const settings_1 = require("./settings");
const dynamic_platform_1 = require("./dynamic-platform");
module.exports = (api) => {
    api.registerPlatform(settings_1.PLATFORM_NAME, dynamic_platform_1.LevelSensePlatform);
};
//# sourceMappingURL=index.js.map