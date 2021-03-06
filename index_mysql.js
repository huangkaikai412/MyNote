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

var mysql = require('mysql');
var connection = mysql.createConnection({
  host: 'localhost',
  user: 'mynote',
  password: '123456',
  database: 'mynote'
});
connection.connect(function (err) {if (err) throw err;});

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
	      
	connection.query('SELECT username, passwd FROM  user WHERE username = ?',username,function(err,user) {
		if (err) {
			console.log(err);
			return res.redirect('/login_register');
		}
		if (user.length === 0) {
			console.log('There is no such user！');
			return res.redirect('/login_register?errcode=11');
		}
		//对密码进行加密
		var md5 = crypto.createHash('md5'),
		      md5password = md5.update(password).digest('hex');
		if (user[0].passwd !== md5password) {
			console.log('Wrong password！');
			return res.redirect('/login_register?errcode=12');
		}
		console.log('Login sucessfully！');
		user[0].passwd = null;
		delete user[0].password;
		req.session.user = user[0];
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
	connection.query('SELECT username, password FROM  user WHERE username=?',username,function(err,user) {
		if (err) {
			console.log(err);
			return res.redirect('/login_register');
		}
		
		if (user.length > 0) {
			console.log('User alredy exists！');
			return res.redirect('/login_register?errcode=21');
		}
		
		//对密码进行加密
		var md5 = crypto.createHash('md5'),
		      md5password = md5.update(password).digest('hex');
		
		//新建用户对象用于保存数据
		var newUser = [username,md5password];
		
		connection.query('INSERT INTO `user`(`username`, `password`) VALUES (?,?)',newUser,function(err,doc) {
			if (err) {
				console.log(err);
				return res.redirect('/login_register');
			}
			console.log('Register sucessfully！');
			return res.redirect('/detail');
		});
	});
});

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
	var note = [req.body.title,
		req.session.user.name,
		req.body.label,
		req.body.note];
	
	connection.query('INSERT INTO `notes`(`title`, `author`, `tag`, `content`) VALUES (?,?,?,?)',note,function(err,doc) {
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
	var username = req.session.user.name;
	connection.query('SELECT * FROM  notes WHERE author=?',username,function(err,list) {
		if (err) {
			console.log(err);
			return res.redirect('/');
		}
		var result = [];
		var total = list.length;
		
		if (total > 0) {
			for(i = (page-1)*rows;i<page*rows;i++) {
				if (i>=total) break;
				result.push(list[i]); 
			}
		}	
		console.log(result);
		res.render('detail',{
			title:'查看笔记',
			list:result,
			page:page,
			total:total
		});
	});
	
	var title = req.query.t ? req.query.t : 0;
	if (title != 0) {
	console.log(title);
	connect.query('DELETE FROM `notes` WHERE title=? & author=?',[title,username],function(err) {
		if (err) {
			console.log(err);
		}
		return res.redirect('/detail');
	});
	}
});

//监听3000端口
app.listen(3000,function(req,res) {
	console.log('app is running at port 3000');
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
