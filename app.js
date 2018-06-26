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
function Emp(name, coreID, job, supervisor, employeeList, total_points){
  this.name=name;
  this.coreID = coreID;
  this.job = job;
  this.supervisor = supervisor;
  this.employeeList = employeeList;
  this.total_points = total_points;
}
var all_people = []
var faris = new Emp("","","","","0");
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

    var activity = "CREATE TABLE IF NOT EXISTS activity(activityID INT AUTO_INCREMENT PRIMARY KEY, coreID VARCHAR(25), accompID INT(3), activity_desc VARCHAR(2500))";
    connection.query(activity, function(err, result) {
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
  res.render('pages/UpdatedIndex');
});

app.get('/login/', function(req, res) {
  res.render('pages/AdministratorLogin');
});

var response = [];
var accomDescriptions = [];
var accomPoints = [];

app.post('/findManager', function(req, res){
  var coreID = req.body.CORE_ID;
  var employee = findPersonByID(coreID, faris, []);
  console.log(employee);
  if(employee[0] != null){
    res.send(employee[0].name);
  } else{
    res.send("Invalid ID");
  }
});

app.post('/viewPoints', function(req, res) {

  var empID = req.body.CORE_ID;
  //var result = findPersonByID(empID, faris, []);
  var personAccomps = [];

  var results = []
  var query = "SELECT * FROM `activity` WHERE coreID="+ connection.escape(empID);
  connection.query(query, function(err, accomplish) {
    if (err) throw err;
    for(accomplishmentTemp in accomplish)
    {
      personAccomps.push(accomplish[accomplishmentTemp]);
    }
    //console.log(personAccomps);
  });

  setTimeout(function(){parseAccomplishments(personAccomps);},500);

  setTimeout(function(){
    //console.log("IN FINAL RESPONSE TIMEOUT");
    //console.log(personAccomps);
    var pointCount = 0;
    response[0] = null;
    response[1] = null;
    response[2] = null;
    var team = findPersonByID(empID, faris, []);
    if(team[0] != null){
      //console.log(team);
      response[0] = "<table><h3>Name: " + team[1] + "</h3><h3>Manager: " + team[0].name + "</h3></br><h4>Your Accomplishments</h4><tbody><tr><th style='text-align: center;'>Accomplishment</th><th style='text-align: center;'>Description</th><th style='text-align:center;'>Points</th></tr>";
      for(val in personAccomps)
      {
        response[0] += "<tr><td>" + accomDescriptions[val] + "</td><td>" + personAccomps[val].activity_desc + "</td><td text-align:center;'>" + accomPoints[val]+ "</td></tr>";
        pointCount += accomPoints[val];
      }
      response[0] += "<tr><td></td><td><h4 style='text-align: right;'>Total Points</h4></td><td style='text-align:center;'>"
      response[0] += pointCount;
      response[0] += "</td></tr>";
      response[0] += "</tbody></table";

      if(team[0].employeeList != null){
        response[1] = "<h4>Your Group</h4><table><tbody><tr><th>Name</th><th>Core ID</th><th>Total Points</th><th>Show More Details</th></tr>";
        for(emps in team[0].employeeList){
          if(team[0].employeeList[emps].coreID != empID){
            response[1] += "<tr><td>" + team[0].employeeList[emps].name + "</td><td>" + team[0].employeeList[emps].coreID+ "</td><td>" + team[0].employeeList[emps].total_points + '</td><td><input type="button" id="' + team[0].employeeList[emps].coreID + '" onclick="showMoreDetails(this)" value="' + team[0].employeeList[emps].coreID + '"/></td><td>';
          }
        }
        response[1] += "</tbody></table>";
      }

      if(team[2].employeeList.length > 0){
        //console.log(team[2].employeeList)
        response[2] = "<h4>Your Employees</h4><table><tbody><tr><th>Name</th><th>Core ID</th><th>Total Points</th><th>Show More Details</th></tr>";

        for(emp in team[2].employeeList){
            response[2] += "<tr><td>" + team[2].employeeList[emp].name + "</td><td>" + team[2].employeeList[emp].coreID+ "</td><td>" + team[2].employeeList[emp].total_points + '</td><td><input type="button" id="' + team[2].employeeList[emp].coreID + '" onclick="showMoreDetails(this)" value="' + team[2].employeeList[emp].coreID + '"/></td><td>';;
        }
        response[2] += "</tbody></table>";
      }
    }
    else{
      response[0] = "Please Enter a Valid ID";
      response[1] = null;
      response[2] = null;
    }
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
  var CORE_ID = req.body.CORE_ID;
  var ACCOMPLISHMENT = req.body.ACCOMPLISHMENT;
  var DESCRIPTION = req.body.DESCRIPTION;
  var MANAGER = req.body.MANAGER;
  console.log(CORE_ID);
  if(CORE_ID != "" && ACCOMPLISHMENT != "" && DESCRIPTION != "" && MANAGER != "" && MANAGER != "Invalid ID"){
    var activity = "INSERT INTO `activity` (`coreID`, `accompID`, `activity_desc`) VALUES (" + connection.escape(CORE_ID) + "," + connection.escape(ACCOMPLISHMENT) + "," +connection.escape(DESCRIPTION) +");";
    connection.query(activity, function(err, result) {
      if (err) throw err;
      //console.log("Inserted activity");
    });

    var newPoints;
    setTimeout(function(){
      var getPoints = "SELECT `points` FROM `accomplishment` WHERE accompID=" + ACCOMPLISHMENT;
      connection.query(getPoints, function(err, result) {
        if (err) throw err;
        //console.log(result);
        newPoints = result[0].points;
      });
    },500);
    setTimeout(function(){
      for(emp in all_people)
      {
        if(all_people[emp].coreID === CORE_ID)
        {
          all_people[emp].total_points += newPoints;
        }
      }
      var points = "UPDATE `employees` SET `total_points` = `total_points` + " + newPoints  + " WHERE `coreID`=" + connection.escape(CORE_ID) + ";";
      //console.log(points);
      connection.query(points, function(err, result) {
        if (err) throw err;
        //console.log("SUCCESSFUL QUERY");
      });
    }, 700);
    res.send("");
}
else{
  res.send("Failure");
  console.log("Error in input fields");
}
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
        var create = "CREATE TABLE employees(coreID VARCHAR(50) PRIMARY KEY, emp_name VARCHAR(255), job VARCHAR(100), supervisor VARCHAR(255), total_points INT(2))";
        connection.query(drop, function(err, result) {
          if (err) throw err;
          //console.log("Dropped");
        });
        connection.query(create, function(err, result) {
          if (err) throw err;
          //console.log("Created");
        });
        //Insert all data
        for(let index = 2; index < data.length; index++){

          //data[index][0] = data[index][0].replace(/[']/g,' ');
          var insert = "INSERT INTO `employees` (`emp_name`, `coreID`, `job`, `supervisor`, `total_points`) VALUES (" + connection.escape(data[index][0]) + "," +connection.escape(data[index][4]) + "," + connection.escape(data[index][6]) + "," + connection.escape(data[index][9]) + "," + 0 + ")";

          connection.query(insert, function(err, row) {
            if (err) throw err;
            //console.log(index);
          });
        }
        //console.log("Done");
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
    faris.total_points = res[0].total_points;
    //console.log(faris);
  });

  //Getting all the employees into a list(all_people)
  var get_all = "SELECT * FROM `employees`";

  connection.query(get_all, function(err, res) {
    //console.log(res);
    if (err) throw err;
    for (var i in res) {
      //Make a new employee using their information
      var person = new Emp("","","","");
      person.name=res[i].emp_name;
      person.coreID = res[i].coreID;
      person.job = res[i].job;
      person.supervisor = res[i].supervisor;
      person.employeeList = [];
      person.total_points = res[i].total_points;
      //Push this to the list of all all_people
      all_people.push(person);
    }
    //console.log(all_people);
  });

  //AFTER WE GET THE DATA, PASS THIS TO A NEW FUNCTION
  //Getting the
  setTimeout(function(){recurseList(faris,all_people);},3000);
  //Print The EMC Tree
  //setTimeout(function(){printTree(faris,0);},5000);

}
var count = 0;
function printFaris(faris){
  //console.log(faris.name);
  printTree(faris, 0);
  //console.log(count);
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
      //console.log("Manager: " + person.name);
      //console.log("Person: " + person.employeeList[emp].name);
      result.push(person);
      result.push(person.employeeList[emp].name);
      result.push(person.employeeList[emp]);
    }
    else{
      findPersonByID(coreID, person.employeeList[emp],result);
    }
  }
  return result;
}
sortEmps();
printTree(faris, 0);
