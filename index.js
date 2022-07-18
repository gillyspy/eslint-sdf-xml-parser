const xports = require('./dist/index');

// babel export strategy for dual purposes;
module.exports = { ...xports , default : {...xports } };
