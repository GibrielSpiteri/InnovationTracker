//Retreiving the neccessary imports below
const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
var csvParser = require('csv-parse');
var fs = require('fs');
var passHash = require('password-hash');
var session = require('express-session');
var $ = jQuery = require('jQuery');
require('./jquery-csv/src/jquery.csv.js');

//Creating the Employee class
function Emp(name, coreID, job, supervisor, employeeList, total_points){
  this.name=name;
  this.coreID = coreID;
  this.job = job;
  this.supervisor = supervisor;
  this.employeeList = employeeList;
  this.total_points = total_points;
}

//Defining Global Variables along with Constant Variables
var all_people = [];
var logged_in = false;
var faris = new Emp("","","","","0");
var periodID = null;
const IMAGE_FOLDER = './images/'
var connection;
var sesh;
var response = [];
var accomDescriptions = [];
var accomPoints = [];

//Setting up the application
var app = express();
app.use(express.static(path.join(__dirname, '/public')));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use(session({secret:'Innovate'}));
app.set('view engine', 'ejs');
var StatusEnum = Object.freeze({"open":1, "closed": 2});
var storage = multer.diskStorage({
  destination:IMAGE_FOLDER,
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + '.jpg')
  }
});
var upload = multer({storage:storage})

//Defining the settings for the database - Will have to change this when moving the server to AWS or Savahnna
const db_config = {
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: 'Zebra123',
  database: 'kiosk'
};

/**
* Function made to execute a given query and if an error occurs, throw the error.
* @param {String} query The query being passed to the function which will be executed in the MySQL database.
*/
function executeQuery(query){
  connection.query(query, function(err, result) {
    if(err) throw err;
  });
}

//Attempts to create various tables in the database if they don't currently exist. This relies on the PeriodID.
function initializeTables(){
  var getCurrentPeriod = "SELECT `periodID` FROM `period` WHERE `currentPeriod`=TRUE"
  connection.query(getCurrentPeriod, function(err, result) {
    periodID = result[0].periodID;
    var activity = "CREATE TABLE IF NOT EXISTS activity_" + connection.escape(result[0].periodID) + "(activityID INT AUTO_INCREMENT PRIMARY KEY, coreID VARCHAR(25), accompID INT(3), activity_desc VARCHAR(2500))";
    executeQuery(activity);

    var points = "CREATE TABLE IF NOT EXISTS emp_points_" + connection.escape(result[0].periodID) + "(coreID VARCHAR(25), points INT(2))";
    executeQuery(points);
  });

  var accomplishments = "CREATE TABLE IF NOT EXISTS accomplishment(accompID INT AUTO_INCREMENT PRIMARY KEY, description VARCHAR(2500), points INT(2))";
  executeQuery(accomplishments);

  var admin_login = "CREATE TABLE IF NOT EXISTS admin(username VARCHAR(25), password VARCHAR(100))";
  executeQuery(admin_login);

  var period = "CREATE TABLE IF NOT EXISTS period(periodID INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(25), startTime DATETIME, endTime DATETIME, currentPeriod BOOLEAN)";
  executeQuery(period);
}

//Attempts to connect to the database and initialize the tables - Will continue to do this until successful
function handleDisconnect() {
  connection = mysql.createConnection(db_config);

  connection.connect((err) => {
    if (err) {
      console.log('Error connecting to db', err);
      setTimeout(handleDisconnect, 2000);
    }
    console.log('Connected');
    initializeTables();
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


var server = app.listen(3005, "localhost", function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening at http://%s:%s", host, port);
})


app.get('/', function(req, res) {
  res.render('pages/UpdatedIndex');
});

app.get('/login', function(req, res) {
  if(sesh.logged_in == true){
    res.render("pages/admin_page")
  } else {
    res.render('pages/AdministratorLogin');
  }
});

app.get('/admin', function(req, res){
  sesh = req.session;
  if( sesh.logged_in ==  null){
    sesh.logged_in = false;
    sesh.username = "";
  }
  if(! sesh.logged_in){
    return res.redirect('/login');
  } else {
    res.render('pages/admin_page');
  }
});


app.post('/auth', function(req, res) {
  sesh = req.session;
  var username = req.body.username;
  var password = req.body.password;
  var query = "SELECT `password` FROM `admin` WHERE `username`= " + connection.escape(username);
  connection.query(query, function(err, result) {
    if (err) throw err;
    if(passHash.verify(password, result[0].password)){
      sesh.logged_in = true;
      sesh.username = username;
      res.render('pages/admin_page');
    }
    else{
      sesh.logged_in = false;
      sesh.username = "";
      return res.redirect('/login');
    }
  });
});

app.post('/updatePass', function(req, res){
  sesh= req.session;
  var currPass = req.body.currPass;
  var newPass = req.body.newPass;
  var repeatPass = req.body.repeatPass;
  if(sesh.logged_in)
  {
    if(newPass == repeatPass){
      //Store username in future and use that as reference
      var passCheck = "SELECT `password` FROM `admin` WHERE `username`="+connection.escape(sesh.username);
      connection.query(passCheck, function(err, result) {
        if (err) throw err;
        if(passHash.verify(currPass, result[0].password)){
          var hashNewPass = passHash.generate(String(newPass));
          var updatePass = "UPDATE `admin` SET `password`=" + connection.escape(hashNewPass) + "WHERE `username`=" + connection.escape("admin");
          connection.query(updatePass, function(err, result) {
            if (err) throw err;
            res.send("Success");
          });
        }
        else{
          res.send("FailureCurrent");
        }
      });
    }
    else{
      res.send("FailureRepeat");
    }
  }
});

app.post('/resetTables', function(req,res){
  var periodName = req.body.periodName;
  var currentPeriodID;
  var getCurrentPeriod = "SELECT `periodID` FROM `period` WHERE `currentPeriod`=TRUE"
  connection.query(getCurrentPeriod, function(err, result) {
    if (err) throw err;
    if(result.length > 0){
      currentPeriodID = result[0].periodID;
      var swapOut = "UPDATE `period` SET `currentPeriod` = FALSE WHERE `periodID`=" + currentPeriodID;
      executeQuery(swapOut);

      var updateCurrentPeriod = "UPDATE `period` SET `endTime`= NOW() WHERE `periodID`=" + currentPeriodID;
      executeQuery(updateCurrentPeriod);
    }
    var newPeriodTable = "INSERT INTO `period` (`name`, `startTime`, `endTime`, `currentPeriod`) VALUES (" + connection.escape(periodName)+ ", NOW(), null, TRUE)";
    executeQuery(newPeriodTable);

    periodID += 1;
    initializeTables();

    var employees = "CREATE TABLE `employees_" + connection.escape(periodID) +"` AS SELECT * FROM `employees_" + connection.escape(periodID-1) + "`";
    connection.query(employees, function(err, result) {
      if (err) throw err;
      var zeroPoints = "UPDATE `employees_" +connection.escape(periodID) +"` SET `total_points`=" + 0;
      connection.query(zeroPoints, function(err, result) {
        if (err) throw err;
        sortEmps();
        res.send("Success");
      });
    });
  });
});



app.post('/findManager', function(req, res){
  var coreID = req.body.CORE_ID;
  var employee = findPersonByID(coreID, faris, []);
  if(employee[0] != null){
    res.send(employee[0].name);
  } else{
    res.send("Invalid ID");
  }
});

app.post('/viewPoints', function(req, res) {
  var empID = req.body.CORE_ID;
  var personAccomps = [];

  var results = [];
  var query = "SELECT * FROM `activity_" + connection.escape(periodID) + "` WHERE coreID="+ connection.escape(empID);
  connection.query(query, function(err, accomplish) {
    if (err) throw err;
    for(accomplishmentTemp in accomplish)
    {
      personAccomps.push(accomplish[accomplishmentTemp]);
    }
  });
  setTimeout(function(){parseAccomplishments(personAccomps);},500);

  setTimeout(function(){
    var pointCount = 0;
    response[0] = null;
    response[1] = null;
    response[2] = null;
    var team = findPersonByID(empID, faris, []);
    if(team[0] != null){
      response[0] = "<table><h3>Name: " + team[1] + "</h3><h3>Manager: " + team[0].name + "</h3></br><h4>Your Accomplishments</h4><tbody><tr><th style='text-align: center;'>Accomplishment</th><th style='text-align: center; word-break:break-all;'>Description</th><th style='text-align:center; width:25%;'>Points</th></tr>";
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
        response[1] = "<h4>Your Group</h4><table><tbody><tr><th style='text-align:center;'>Name</th><th style='text-align:center;'>Core ID</th><th style='text-align:center;'>Total Points</th><th style='text-align:center;'>Show More Details</th></tr>";
        for(emps in team[0].employeeList){
          if(team[0].employeeList[emps].coreID != empID){
            response[1] += "<tr><td>" + team[0].employeeList[emps].name + "</td><td>" + team[0].employeeList[emps].coreID+ "</td><td>" + team[0].employeeList[emps].total_points + '</td><td><input type="button" id="' + team[0].employeeList[emps].coreID + '" onclick="showMoreDetails(this)" value="View"/></td><td>';
          }
        }
        response[1] += "</tbody></table>";
      }
      if(team[2].employeeList.length > 0){
        response[2] = "<h4>Your Employees</h4><table width='100%' style='margin:0px; padding: 0;'><tbody><tr><th style='text-align:center;'>Name</th><th style='text-align:center;'>Core ID</th><th style='text-align:center;'>Total Points</th><th style='text-align:center;'>Show More Details</th></tr>";

        for(emp in team[2].employeeList){
            response[2] += "<tr><td>" + team[2].employeeList[emp].name + "</td><td>" + team[2].employeeList[emp].coreID+ "</td><td>" + team[2].employeeList[emp].total_points + '</td><td><input type="button" id="' + team[2].employeeList[emp].coreID + '" onclick="showMoreDetails(this)" value="View"/></td><td>';;
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
  if(CORE_ID != "" && ACCOMPLISHMENT != "" && DESCRIPTION != "" && MANAGER != "" && MANAGER != "Invalid ID"){
    var activity = "INSERT INTO `activity_" + connection.escape(periodID) + "` (`coreID`, `accompID`, `activity_desc`) VALUES (" + connection.escape(CORE_ID) + "," + connection.escape(ACCOMPLISHMENT) + "," +connection.escape(DESCRIPTION) +");";
    executeQuery(activity);
    var newPoints;
    setTimeout(function(){
      var getPoints = "SELECT `points` FROM `accomplishment` WHERE accompID=" + ACCOMPLISHMENT;
      connection.query(getPoints, function(err, result) {
        if (err) throw err;
        newPoints = result[0].points;
      });
    },500);
    setTimeout(function(){
      for(emp in all_people){
        if(all_people[emp].coreID === CORE_ID){ all_people[emp].total_points += newPoints; }
      }
      var ID_Check = "SELECT `coreID` FROM `emp_points_" + connection.escape(periodID) + "` WHERE `coreID` = "  + connection.escape(CORE_ID);
      connection.query(ID_Check, function(err, result) {
        if (err) throw err;
        if(result.length == 0){
          var newEmpPoints = "INSERT INTO `emp_points_" + connection.escape(periodID) + "` (`coreID`, `points`) VALUES (" + connection.escape(CORE_ID)+ ","+ newPoints +")";
          executeQuery(newEmpPoints);
        }
        else{
          var points = "UPDATE `emp_points_" + connection.escape(periodID) + "` SET `points`=`points` +" + newPoints;
          executeQuery(points);
        }
      });
    }, 700);
    res.send("");
  }
  else{
    res.send("Failure");
  }
});

app.post('/add_csv', function(req, res) {
  fs.readFile('public/emps.csv', {
    encoding: 'utf-8'
  }, function(err, csvData) {
    if (err) {console.log(err);}
    csvParser(csvData, {
      delimiter: ','
    }, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        var drop = "DROP TABLE employees_" + connection.escape(periodID);
        //Reset the table
        var create = "CREATE TABLE employees_" + connection.escape(periodID) + "(coreID VARCHAR(50) PRIMARY KEY, emp_name VARCHAR(255), job VARCHAR(100), supervisor VARCHAR(255), total_points INT(2))";
        executeQuery(drop);
        executeQuery(create);
        //Insert all data
        for(let index = 2; index < data.length; index++){
          var insert = "INSERT INTO `employees_" + connection.escape(periodID) + "` (`emp_name`, `coreID`, `job`, `supervisor`, `total_points`) VALUES (" + connection.escape(data[index][0]) + "," +connection.escape(data[index][4]) + "," + connection.escape(data[index][6]) + "," + connection.escape(data[index][9]) + ","+ 0 +")";
          executeQuery(insert);
        }
        var refillPoints = "SELECT * FROM `emp_points_" + connection.escape(periodID) + "`";
        connection.query(refillPoints, function(err, result) {
          if (err) throw err;
          for(emp in result){
            var coreIDWithPoints = result[emp].coreID;
            var thePoints = result[emp].points;
            var updatePoints = "UPDATE `employees_" + connection.escape(periodID) + "` SET `total_points`=" + thePoints + " WHERE `coreID` = " + connection.escape(coreIDWithPoints);
            executeQuery(updatePoints);
          }
        });
      }
      setTimeout(function(){sortEmps();}, 4500);
      setTimeout(function(){return res.redirect('/admin');}, 6010);
    });
  });

});


function getPeriodID(){
  var getCurrentPeriod = "SELECT `periodID` FROM `period` WHERE `currentPeriod`=TRUE"
  connection.query(getCurrentPeriod, function(err, res) {
    if (err) throw err;
    periodID = res[0].periodID;
  });
}

function sortEmps(){
  //Getting faris from the database by his 'emp_name'
  var get_faris = "SELECT * FROM `employees_" + connection.escape(periodID) + "` WHERE `emp_name` = 'Habbaba, Mr. Faris S (Faris)'";
  faris = new Emp("","","","","0");
  connection.query(get_faris, function(err, res) {

    if (err) throw err;
    faris.name = res[0].emp_name;
    faris.coreID = res[0].coreID;
    faris.job = res[0].job;
    faris.supervisor = res[0].supervisor;
    faris.employeeList = [];
    faris.total_points = res[0].total_points;
  });

  //Getting all the employees into a list(all_people)
  var get_all = "SELECT * FROM `employees_" + connection.escape(periodID) + "`";
  all_people = [];
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
      person.total_points = res[i].total_points;
      //Push this to the list of all all_people
      all_people.push(person);
    }
  });

  setTimeout(function(){recurseList(faris,all_people);},2000);

}
function printFaris(faris){
  printTree(faris, 0);
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
    printTree(person.employeeList[emp], currentTabs+1);
  }


}

function findPersonByID(coreID, person, result){
  for(emp in person.employeeList){
    if(person.employeeList[emp].coreID === coreID){
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

function startApplication(){
  handleDisconnect();
  getPeriodID();
  setTimeout(function(){sortEmps();},2000);
}

//Calling the main function below
startApplication();
