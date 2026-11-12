const mongo = require('mongoose');

const Schema = new mongo.Schema({
	Guild: String,
	User: String,
	DataVersion: Number,

	Warnings: [{ reason: String, admin: String, date: Date }],
});
module.exports = mongo.model('users', Schema);
