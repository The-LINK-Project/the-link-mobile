/**
 * Each lesson recording becomes its own file name under test, instead of the
 * `1` jest-expo gives every asset, so a test can tell which one played.
 */
const path = require("path");

module.exports = {
    process: (_source, filename) => ({
        code: `module.exports = ${JSON.stringify(path.basename(filename))};`,
    }),
};
