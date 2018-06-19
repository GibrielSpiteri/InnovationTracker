const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
var csvParser = require('csv-parse');
var fs = require('fs');
var $ = jQuery = require('jQuery');
require('./jquery-csv/src/jquery.csv.js');

var app = express();
app.use(express.static(path.join(__dirname, '/public')));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
const IMAGE_FOLDER = './images/'
var StatusEnum = Object.freeze({"open":1, "closed": 2});
var storage = multer.diskStorage({
  destination:IMAGE_FOLDER,
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + '.jpg')
  }
});
var upload = multer({storage:storage})
var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'Zebra.mail.bot@gmail.com', // Your email id
    pass: '^.j\"gk)253{j]hCJr&gZ9N\'^Th5Fh3V9/K5gU^7aW64whrn(xwB+TksM)9ZQ'
  }
});

const db_config = {
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: 'Zebra123',
  database: 'kiosk'
};
var connection;

function handleDisconnect() {
  connection = mysql.createConnection(db_config);

  connection.connect((err) => {
    if (err) {
      console.log('Error connecting to db', err);
      setTimeout(handleDisconnect, 2000);
    }
    console.log('Connected');
    var table1 = "CREATE TABLE IF NOT EXISTS activity(activity_num INT AUTO_INCREMENT PRIMARY KEY, core_id VARCHAR(25), achievement VARCHAR(100), description VARCHAR(5000), points INT(2))";
    connection.query(table1, function(err, result) {
      if (err) throw err;
      console.log("Event table created");
    });

  });
  connection.on('error', function(err) {
    console.log('db error', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();

var server = app.listen(3005, "10.61.204.94", function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening at http://%s:%s", host, port);
})

app.get('/', function(req, res) {
  res.render('pages/index');
});
app.get('/ViewPoints', function(req, res) {
  res.render('pages/Points');
});
app.get('/ViewEmps', function(req, res) {
  res.render('pages/ViewEmps');
});

app.post('/add_csv', function(req, res) {
  fs.readFile('public/emps.csv', {
    encoding: 'utf-8'
  }, function(err, csvData) {
    if (err) {
      console.log(err);
    }

    csvParser(csvData, {
      delimiter: ','
    }, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        //Reset the table
        var drop = "DROP TABLE IF EXISTS employees";
        var create = "CREATE TABLE employees(emp_name VARCHAR(255), coreID VARCHAR(50), job VARCHAR(100), supervisor VARCHAR(255))";
        connection.query(drop, function(err, result) {
          if (err) throw err;
          console.log("Dropped");
        });
        connection.query(create, function(err, result) {
          if (err) throw err;
          console.log("Created");
        });
        //Insert all data
        for(let index = 2; index < data.length; index++){

          //data[index][0] = data[index][0].replace(/[']/g,' ');
          var insert = "INSERT INTO `employees` (`emp_name`, `coreID`, `job`, `supervisor`) VALUES (" + connection.escape(data[index][0]) + "," +connection.escape(data[index][4]) +","+connection.escape(data[index][6]) + "," + connection.escape(data[index][9])+ ")";

          connection.query(insert, function(err, row) {
            if (err) throw err;
            var numRows = row.affectedRows;
            console.log(index);
          });
        }
        console.log("Done");
      }
    });
  });
});
