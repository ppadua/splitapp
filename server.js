const express = require('express');
const app = express();
const bodyParser= require('body-parser')
const cookieParser = require('cookie-parser');
const mysql = require('mysql');  
const session = require('express-session')
const moment = require('moment');

const connection   = mysql.createConnection({  
    host: "localhost",  
    user: "root",  
    password: "",  
    database: "dc_project_manager" 
});
connection.connect(function(err) {
	if (err) throw err;

	console.log("connected")
});

app.use(session({
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true,
	cookie: {}
}))

app.use(cookieParser('dcexpressninjagold88'))
app.use(express.urlencoded())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

app.use(express.static(__dirname + "/public"));

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

//Do not edit the '/' route below
app.get('/', function(req, res) {
	res.redirect("/main")
});

app.get('/main', function(req, res) {
    if(req.session.user_name == undefined)
        res.render('index');
    else
        res.redirect("/projects")
});

app.get('/create', function(req, res) {
    if(req.session.user_name != undefined)
        res.render('create');
    else
        res.redirect("/")
});

app.get('/projects', function(req, res) {
    if(req.session.user_name != undefined)
        connection.query("SELECT *, projects.id as project_id, group_concat(tasks.task_status) as all_task_status FROM user_projects LEFT JOIN users ON users.id = user_projects.user_id  LEFT JOIN projects ON projects.id = user_projects.project_id LEFT JOIN tasks ON tasks.project_id = projects.id WHERE user_projects.user_type = 9 GROUP BY projects.id", req.body.name, function(err, user_results){


            for(var index in user_results){
                if(user_results[index].all_task_status != null){
                    user_results[index].all_task_status = ((user_results[index].all_task_status.search("1") == 0  || user_results[index].all_task_status.search("2")  == 0) ? false : true);
                }
            }

            res.render('projects', {user_results : user_results, user_session : req.session});
        })
    else
        res.redirect("/")

});

app.post("/create_project", function(req, result){
    var projects_post_data = [
        req.body.title,
        req.body.description,
        req.body.timeframe_from,
        req.body.timeframe_to,
    ];

    connection.query("INSERT INTO projects (title, description, timeframe_from, timeframe_to) VALUES (?, ?, ?, ?);", projects_post_data,  function(err, res){
        var user_projects_post_data = [
            req.session.user_id,
            res.insertId,
            9
        ];

        connection.query("INSERT INTO user_projects (user_id, project_id, user_type) VALUES (?, ?, ?);", user_projects_post_data, function(err,res){
            result.redirect("/project/"+user_projects_post_data[1]);
        })
    })
})



app.get('/project/:project_id', function(req, res) {
    if(req.session.user_name != undefined){
        /* PROJECT DETAILS */
        connection.query("SELECT *, users.id as user_id, projects.id as project_id FROM user_projects LEFT JOIN users ON users.id = user_projects.user_id  LEFT JOIN projects ON projects.id = user_projects.project_id WHERE user_projects.project_id = ? AND user_projects.user_type = 9", req.params.project_id, function(err, project_details_results){
            /* PROJECT MEMBERS */
            connection.query("SELECT *, users.id as user_id, projects.id as project_id FROM user_projects LEFT JOIN users ON users.id = user_projects.user_id  LEFT JOIN projects ON projects.id = user_projects.project_id WHERE user_projects.project_id = ?", req.params.project_id, function(err, project_member_results){
                /* PROJECT TASKS */
                connection.query("SELECT tasks.*, tasks.id as task_id, users.* FROM tasks LEFT JOIN projects ON projects.id = tasks.project_id LEFT JOIN users ON users.id = tasks.user_assigned_id WHERE projects.id = ?", req.params.project_id, function(err, project_task_results){

                    var member_ids = [];
                    for(var index in project_member_results){
                        member_ids.push(project_member_results[index].user_id)
                    }

                    /* USER THAT ARE NOT MEMBERS */
                    connection.query("SELECT * FROM users WHERE users.id NOT IN ("+member_ids+")", function(err, not_member_results){
                        res.render('project', {
                            project_details_results: project_details_results[0],
                            project_member_results: project_member_results,
                            project_task_results: project_task_results,
                            not_member_results: not_member_results,
                        });    
                    });
                });
            });
        });
    }
    else{
        res.redirect("/")
    }
});



app.post('/new_user', function(req, result) {
      connection.query("SELECT * FROM users WHERE name = ?", req.body.name, function(err, user_result){
        if(user_result.length > 0){
            req.session.user_name = user_result[0].name
            req.session.user_id =  user_result[0].id
            result.redirect('/projects');
        }
        else{
            connection.query("INSERT INTO users (name) VALUES (?);", req.body.name, function(err,res){
                req.session.user_name = req.body.name;
                req.session.user_id = res.insertId;
                result.redirect('/projects');
            })
        }
    })
});

app.post("/add_task", function(req, result){
    task_post_data = [
        req.body.project_id,
        req.body.user_id,
        req.body.description,
        1
    ];

    connection.query("INSERT INTO tasks (project_id, user_assigned_id, description, task_status) VALUES (?, ?, ?, ?);", task_post_data, function(err,res){
        result.redirect("/project/"+req.body.project_id);
    })
})

app.post("/add_member", function(req, result){
    var user_projects_post_data = [
        req.body.user_id,
        req.body.project_id,
        1
    ];

    connection.query("INSERT INTO user_projects (user_id, project_id, user_type) VALUES (?, ?, ?);", user_projects_post_data, function(err,res){
        result.redirect("/project/"+user_projects_post_data[1]);
    })
})

app.get("/update_task_status/:project_id/:task_id/:task_status", function(req, result){
    connection.query("UPDATE tasks SET task_status = ? WHERE tasks.id = ?", [req.params.task_status, req.params.task_id], function(err,res){
        result.redirect("/project/"+req.params.project_id);
    })
})

app.get("/logout", function(req, result){
    req.session.destroy(function(){
        result.redirect("/");
    })
})

app.get("/autocommit_on", function(req, result){
    connection.query("SET autocommit = 1;",function() {
        connection.query("START TRANSACTION;",function() {
            result.redirect("/");
        });
    });
})

app.get("/autocommit_off", function(req, result){
    connection.query("ROLLBACK;",function() {
        connection.query("select @@autocommit = 0;",function() {
            result.redirect("/");
        });
    });
})

app.listen(8000, function(){
    console.log('Your node js server is running on PORT 8000');
});