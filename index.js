//加载依赖库
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var session = require('express-session');

//引入模型并连接mongoose服务
//var mongoose = require('mongoose');
//var models = require('./models/models');
//var Note = models.Note;
//var User = models.User;
//mongoose.connect('mongodb://localhost:27017/notes');
//mongoose.connection.on('error',console.error.bind(console,'fail to connect mongo'));

var Waterline = require('waterline');
var mysqlAdapter = require('sails-mysql');
var mongoAdapter = require('sails-mongo');

// 适配器
var adapters = {
  	mongo: mongoAdapter,
  	mysql: mysqlAdapter,
  	default: 'mysql'
};

// 连接
var connections = {
  	mongo: {
    		adapter: 'mongo',
    		url: 'mongodb://localhost:27017/notes'
  	},
  	mysql: {
    		adapter: 'mysql',
    		url: 'mysql://mynote:123456@localhost:3306/mynote',
  	}
};

//数据模型
var User = Waterline.Collection.extend({
	identity: 'user',
  	connection: 'mysql',
  	schema: true,
  	migrate:'safe',
  	attributes: {
  		username:'String',
		password:'String',
		email:'String',
		createTime:'date'
  	},
  	beforeCreate: function(v, cb){
    		v.createTime = new Date();
    	return cb();
  	}
})

var Note = Waterline.Collection.extend({
	identity: 'notes',
  	connection: 'mysql',
  	schema: true,
  	migrate:'safe',
  	attributes: {
  		title:'String',
		author:'String',
		tag:'String',
		content:'String',
		createTime:'date'
  	},
  	beforeCreate: function(v, cb){
    		v.createTime = new Date();
    	return cb();
  	}
})

var orm = new Waterline();
orm.loadCollection(User);
orm.loadCollection(Note);

var config = {
	adapters: adapters,
	connections: connections,
	port:3000
}

orm.initialize(config, function(err, models){
  	if(err) {
    		console.log('waterline initialize failed, err:', err);
    	return;
  	}
  	console.log('waterline initialize success.');

//创建express实例
var app = express();

//定义EJS模板引擎和模板文件位置
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');

//定义静态文件目录
app.use(express.static(path.join(__dirname,'public')));

//定义数据解析器
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

//建立session模型
app.use(session({
	secret:'1234',
	name:'mynote',
	cookie:{maxAge:1000*60*20},//设置session保存时间为20分钟
	resave:false,
	saveUninitialized:true
}));

//响应首页get请求
app.get('/',function(req,res) {
	res.render('index',{
		title:'首页'
	});
});

app.get('/login_register',function(req,res) {
	if (typeof(req.session.user) !== 'undefined' && req.session.user) return res.redirect('/detail');
	res.render('login_register',{
		title:'登录/注册'
	});
});

//登录表单数据处理
app.post('/login',function(req,res) {
	//获取表单每项数据
	var username = req.body.login_name;
	      password = req.body.login_password;
	    
	models.collections.user.findOne({username:username},function(err,user) {
		if (err) {
			console.log(err);
			return res.redirect('/login_register');
		}
		if (!user) {
			console.log('There is no such user！');
			return res.redirect('/login_register?errcode=11');
		}
		//对密码进行加密
		var md5 = crypto.createHash('md5'),
		      md5password = md5.update(password).digest('hex');
		if (user.password !== md5password) {
			console.log('Wrong password！');
			return res.redirect('/login_register?errcode=12');
		}
		console.log('Login sucessfully！');
		user.password = null;
		delete user.password;
		req.session.user = user;
		return res.redirect('/detail');
	});
	
});

//注册表单数据处理
app.post('/register',function(req,res) {
	//获取表单每项数据
	var username = req.body.register_name,
	      password = req.body.register_password;
	      
//	//检查输入的用户名是否为空
//	if (username.trim().length == 0) {
//		console.log('用户名不能为空！');
//		return res.redirect('/login_register');
//	}
//	
//	//检查输入的用户名是否为空
//	if (password.trim().length == 0) {
//		console.log('密码不能为空！');
//		return res.redirect('/login_register');
//	}
	
	//检查用户名是否存在，如果不存在，则保存该记录
	models.collections.user.findOne({username:username},function(err,user) {
		if (err) {
			console.log(err);
			return res.redirect('/login_register');
		}
		
		if (user) {
			console.log('User alredy exists！');
			return res.redirect('/login_register?errcode=21');
		}
		
		//对密码进行加密
		var md5 = crypto.createHash('md5'),
		      md5password = md5.update(password).digest('hex');
		
		//新建用户对象用于保存数据
		var newUser = {
			username:username,
			password:md5password
		};
		
		models.collections.user.create(newUser,function(err,doc) {
			if (err) {
				console.log(err);
				return res.redirect('/login_register');
			}
			console.log('Register sucessfully！');
			return res.redirect('/detail');
		});
	});
});

//app.get('/login',function(req,res) {
//	res.render('login_register',{
//		title:'登录/注册'
//	});
//});

app.get('/quit',function(req,res) {
	req.session.user = null;
	return res.redirect('/login_register')
});

app.get('/post',function(req,res) {
	res.render('post',{
		title:'发布'
	});
	
	if (typeof(req.session.user) == 'undefined' | !req.session.user) return res.redirect('/login_register');
});

app.post('/post',function(req,res) {
	var note = {
		title:req.body.title,
		author:req.session.user.username,
		tag:req.body.label,
		content:req.body.note
	};
	
	models.collections.notes.create(note,function(err,doc) {
		if (err) {
			console.log(err);
			return res.redirect('/post');
		}
		console.log('Post sucessfully！');
		return res.redirect('/detail');
	});
});

app.get('/detail',function(req,res) {	
	if (typeof(req.session.user) == 'undefined' | !req.session.user) return res.redirect('/login_register');
	
	var page = req.query.p ? parseInt(req.query.p) : 1;
	var rows = 6;
	var notes = models.collections.notes.find({author:req.session.user.username});
	notes.skip((page-1)*rows).limit(rows);
	notes.exec(function(err,list) {
		if (err) {
			console.log(err);
			return res.redirect('/');
		}
		models.collections.notes.find({author:req.session.user.username},function(err,rs) {
			if (err) {
				console.log(err);
				return res.redirect('/');
			}
			var total = parseInt(rs.length/6+1);
			res.render('detail',{
				title:'查看笔记',
				list:list,
				page:page,
				total:total
			});
		});
	});
	
	var title = req.query.t ? req.query.t : 0;
	if (title != 0) {
	console.log(title);
	models.collections.notes.destroy({author:req.session.user.username,title:title},function(err) {
		if (err) {
			console.log(err);
		}
		return res.redirect('/detail');
	});
	}
});

//app.get("/delete",function(req,res) {
//	if (typeof(req.session.user) == 'undefined' | !req.session.user) return res.redirect('/login_register');
//	
//	var title = req.query.t;
//	Note.remove({author:req.session.user.username,title:title},function(err) {
//		if (err) {
//			console.log(err);
//		}
//		return res.redirect('/detail');
//	});
//});

//监听3000端口
app.listen(config.port, function(){
   	console.log('Express listening on port:', config.port);
});
});


//Date格式化
Date.prototype.Format = function (fmt) { //author: meizz 
	var o = {
    	"M+": this.getMonth() + 1, //月份 
    	"d+": this.getDate(), //日 
    	"h+": this.getHours(), //小时 
    	"m+": this.getMinutes(), //分 
    	"s+": this.getSeconds(), //秒 
    	"q+": Math.floor((this.getMonth() + 3) / 3), //季度 
    	"S": this.getMilliseconds() //毫秒 
	};
	if (/(y+)/.test(fmt)) 
		fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
		if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
	return fmt;
}
