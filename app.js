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
function Emp(name, coreID, job, supervisor, employeeList){
  this.name=name;
  this.coreID = coreID;
  this.job = job;
  this.supervisor = supervisor;
  this.employeeList = employeeList;
}
var all_people = []
var faris = new Emp("","","","");
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

    var table1 = "CREATE TABLE IF NOT EXISTS activity(activityID INT AUTO_INCREMENT PRIMARY KEY, coreID VARCHAR(25), accompID INT(3), activity_desc VARCHAR(2500))";
    connection.query(table1, function(err, result) {
      if (err) throw err;
      console.log("Event table created");
    });

    var accomplishments = "CREATE TABLE IF NOT EXISTS accomplishment(accompID INT AUTO_INCREMENT PRIMARY KEY, description VARCHAR(2500), points INT(2))";
    connection.query(accomplishments, function(err, result) {
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

var server = app.listen(3005, "localhost", function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening at http://%s:%s", host, port);
})

app.get('/', function(req, res) {
  res.render('pages/newindex');
});
app.get('/ViewPoints', function(req, res) {
  res.render('pages/Points');
});
app.get('/ViewEmps', function(req, res) {
  res.render('pages/ViewEmps');
});

var response = "";
var accomDescriptions = [];
var accomPoints = [];
app.post('/viewPoints', function(req, res) {

  var empID = req.body.CORE_ID;
  //var result = findPersonByID(empID, faris, []);
  var personAccomps = [];
  var query = "SELECT * FROM `activity` WHERE coreID="+ connection.escape(empID);
  connection.query(query, function(err, accomplish) {
    if (err) throw err;
    for(accomplishmentTemp in accomplish)
    {
      personAccomps.push(accomplish[accomplishmentTemp]);
    }
    console.log(personAccomps);
  });

  setTimeout(function(){parseAccomplishments(personAccomps);},500);
  // res.writeHead(200, {'Content-Type': 'text/html'});
  // res.write('<html><head><link rel="stylesheet" href="/styles.css"></head><body>');
  // res.write()
  setTimeout(function(){
    console.log("IN FINAL RESPONSE TIMEOUT");
    console.log(personAccomps);
    var pointCount = 0;
    for(val in personAccomps)
    {
      if(val == 0){
        response += "<h3>" + ;
        response = "<table><tr><th>Accomplishment</th><th>Description</th><th>Points</th></tr>";

      }
      response += "<tr><td>";
      response += accomDescriptions[val];
      response += "</td><td>";
      response += personAccomps[val].activity_desc;
      response += "</td><td>";
      response += accomPoints[val];
      pointCount += accomPoints[val];
      response += "</td></tr>";
    }
    response += "<tr><td></td><td>Total Points</td><td>"
    response += pointCount;
    response += "</td></tr>";
    response += "</table";
    res.send(response);
  },700);

});

function parseAccomplishments(personAccomps){
  accomDescriptions = [];
  accomPoints = [];
  for(accomplishLocation in personAccomps)
  {
    var accomp = "SELECT * FROM `accomplishment` WHERE accompID=" + personAccomps[accomplishLocation].accompID;
    connection.query(accomp, function(err, res) {
      if (err) throw err;
      accomDescriptions.push(res[0].description);
      accomPoints.push(res[0].points);
    });
  }
}



app.post('/addPoints', function(req, res) {
  var CORE_ID =req.body.CORE_ID;
  var ACCOMPLISHMENT = req.body.ACCOMPLISHMENT;
  var DESCRIPTION = req.body.DESCRIPTION;

  var points = "INSERT INTO `activity` (`coreID`, `accompID`, `activity_desc`) VALUES (" + connection.escape(CORE_ID) + "," + connection.escape(ACCOMPLISHMENT) + "," +connection.escape(DESCRIPTION) +");";
  connection.query(points, function(err, result) {
    if (err) throw err;
    console.log("Inserted activity");
  });
  res.send("");
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
            //console.log(index);
          });
        }
        console.log("Done");
      }
    });
  });
});

function sortEmps(){

  //Getting faris from the database by his 'emp_name'
  var get_faris = "SELECT * FROM `employees` WHERE `emp_name` = 'Habbaba, Mr. Faris S (Faris)'";
  connection.query(get_faris, function(err, res) {

    if (err) throw err;
    faris.name=res[0].emp_name;
    faris.coreID = res[0].coreID;
    faris.job = res[0].job;
    faris.supervisor = res[0].supervisor;
    faris.employeeList = [];
    console.log(faris);
  });

  //Getting all the employees into a list(all_people)
  var get_all = "SELECT * FROM `employees`";

  connection.query(get_all, function(err, res) {
    if (err) throw err;
    for (var i in res) {
      //Make a new employee using their information
      var person = new Emp("","","","");
      person.name=res[i].emp_name;
      person.coreID = res[i].coreID;
      person.job = res[i].job;
      person.supervisor = res[i].supervisor;
      person.employeeList = [];

      //Push this to the list of all all_people
      all_people.push(person);
    }
    //console.log(all_people);
  });

  //AFTER WE GET THE DATA, PASS THIS TO A NEW FUNCTION
  //Getting the
  setTimeout(function(){recurseList(faris,all_people);},3000);
}
var count = 0;
function printFaris(faris){
  console.log(faris.name);
  printTree(faris, 0);
  console.log(count);
}

function recurseList(person, all_people)
{
  for(val in all_people)
  {
    if(all_people[val].supervisor === person.name)
    {
      person.employeeList.push(all_people[val]);
      recurseList(all_people[val], all_people);
    }
  }

}

function printTree(person, currentTabs){
  for(emp in person.employeeList){

    var tabs = "\t";
    for(let i = 0; i < currentTabs; i++){
      tabs += "\t";
    }
    count++;
    console.log(tabs + person.employeeList[emp].name);
    printTree(person.employeeList[emp], currentTabs+1);
  }


}

function findPersonByID(coreID, person, result){
  for(emp in person.employeeList){
    if(person.employeeList[emp].coreID === coreID){
      console.log("Manager: " + person.name);
      console.log("Person: " + person.employeeList[emp].name);
      result.push(person.name);
      result.push(person.employeeList[emp]);
    }
    else{
      findPersonByID(coreID, person.employeeList[emp],result);
    }
  }
  return result;
}
sortEmps();
