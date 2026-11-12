const mongo = require('mongoose');

const Schema = new mongo.Schema({
    ThreadId: String,
    CreatorId: String,
    StartDate: Date,
    InputValues: Object,
    PartNum: String,
    UserMentionsId: [String],
    RoleMentionsId: [String],
    PartyRole: String,
});
module.exports = mongo.model('parties', Schema);
