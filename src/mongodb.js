const mongoose = require('mongoose');
const Agenda = require("agenda");
// Connection string is configurable via MONGO_URL. The default matches the
// `mongo_db` service defined in docker-compose.yml.
const {
	MONGO_URL,
	MONGO_INITDB_ROOT_USERNAME = 'root',
	MONGO_INITDB_ROOT_PASSWORD = 'admin',
} = process.env
const connectionString = MONGO_URL
	|| `mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@mongo_db:27017/?authMechanism=DEFAULT&retryWrites=true&w=majority`
mongoose.connect(connectionString).then(() => console.log('Connected to Mongodb.'));
const agenda = new Agenda({ db: { address: connectionString } });

module.exports = {
	GuildSchema: require('./models/Guild'),
	UserSchema: require('./models/User'),
	PartySchema: require('./models/Party'),
	AgendaScheduler: agenda
}