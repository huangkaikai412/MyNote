var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
	username:String,
	password:String,
	email:String,
	createTime:{
		type:Date,
		default:Date.now
	}
});

var noteSchema = new Schema({
	title:String,
	author:String,
	tag:String,
	content:String,
	createTime:{
		type:Date,
		default:Date.now
	}
});

exports.Note= mongoose.model('Note',noteSchema);
exports.User = mongoose.model('User',userSchema);
