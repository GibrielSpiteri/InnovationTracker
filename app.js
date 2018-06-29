//Retreiving the neccessary imports below
const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const csvParser = require('csv-parse');
const fs = require('fs');
const passHash = require('password-hash');
const session = require('express-session');
const $ = jQuery = require('jQuery');
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
var alllall_people = [];
var pastPeriods = new Map();
var logged_in = false;
var tempfaris = [];
var faris = new Emp("","","","","0");
var periodID = null;
const IMAGE_FOLDER = './images/'
var connection;
var sesh;
var response = [];
var accomDescriptions = [];
var accomPoints = [];
const REQUIREDPOINTS = 8;
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

/**
* Attempts to create various tables in the database if they don't currently exist. This relies on the PeriodID.
*/
function initializeTables(){

  var period = "CREATE TABLE IF NOT EXISTS period(periodID INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(25), startTime DATETIME, endTime DATETIME, currentPeriod BOOLEAN)";
  executeQuery(period);
  var firstPeriod = "SELECT * FROM `period`";
  connection.query(firstPeriod, function(err, result) {
    if(result.length == 0){
      var makeFirstPeriod = "INSERT INTO `period` (`name`, `startTime`, `currentPeriod`) VALUES ('Initial Period', NOW(), TRUE)";
        connection.query(makeFirstPeriod, function(err, result) {
          var getCurrentPeriod = "SELECT `periodID` FROM `period` WHERE `currentPeriod`=TRUE"
          connection.query(getCurrentPeriod, function(err, result) {
            periodID = result[0].periodID;
            var activity = "CREATE TABLE IF NOT EXISTS activity_" + connection.escape(result[0].periodID) + "(activityID INT AUTO_INCREMENT PRIMARY KEY, coreID VARCHAR(50), accompID INT(3), activity_desc VARCHAR(2500))";
            executeQuery(activity);

            var points = "CREATE TABLE IF NOT EXISTS emp_points_" + connection.escape(result[0].periodID) + "(coreID VARCHAR(50), points INT(2))";
            executeQuery(points);

            var employees = "CREATE TABLE IF NOT EXISTS employees_" + connection.escape(result[0].periodID) + "(coreID VARCHAR(50) PRIMARY KEY, emp_name VARCHAR(255), job VARCHAR(100), supervisor VARCHAR(255), total_points INT(2))";
            executeQuery(employees);
          });
        });
    }
  });

  var accomplishments = "CREATE TABLE IF NOT EXISTS accomplishment(accompID INT AUTO_INCREMENT PRIMARY KEY, description VARCHAR(2500), points INT(2))";
  executeQuery(accomplishments);

  var admin_login = "CREATE TABLE IF NOT EXISTS admin(username VARCHAR(25), password VARCHAR(100))";
  connection.query(admin_login, function(err, result) {
    if (err) throw err;
    //Default account when the table is first created, it is recommended to update the password when you login.
    var new_admin = "INSERT INTO `admin` (`username`, `password`) VALUES ('admin', 'sha1$5c533d80$1$5acc18ff74b44a3c9ac0308e78836e83a73eb9e0')";
    executeQuery(new_admin);
  });



}

/**
* Attempts to connect to the database and initialize the tables - Will continue to do this until successful
*/
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

/**
* Directs the user to the main application page. ~ index.ejs
*/
app.get('/', function(req, res) {
  res.render('pages/index');
});

/**
* Directs the user to the admin login page if they are not already logged in. ~ AdministratorLogin.ejs
* Makes use of session variable 'sesh' to track the login state.
*/
app.get('/login', function(req, res) {
  sesh = req.session;

  if(sesh.logged_in == undefined)
  {
    sesh.logged_in = false;
    sesh.username = "";
  }
  if(sesh.logged_in == true){
    res.render("pages/admin_page")
  } else {
    res.render('pages/AdministratorLogin');
  }
});

/**
* Directs the user to the admin pannel when they are successfully logged in. ~ admin_page.ejs
*/
app.get('/admin', function(req, res){
  sesh = req.session;
  if( sesh.logged_in ==  undefined){
    sesh.logged_in = false;
    sesh.username = "";
  }
  if(! sesh.logged_in){
    return res.redirect('/login');
  } else {
    res.render('pages/admin_page');
  }
});

/**
* Authenication request for the admin login.
* Queries the admin database for the hashed password and checks it against inputted password.
* If the password was correct, the session variable updates and the user is redirected to the admin page.
*/
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
      return res.redirect('/admin');
    }
    else{
      sesh.logged_in = false;
      sesh.username = "";
      return res.redirect('/login');
    }
  });
});

/**
* Accessed through the admin page.
* This function updates the admin's password.
*/
app.post('/updatePass', function(req, res){
  sesh = req.session;
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

/**
* Accessed through the admin page.
* This function ends the current tracking period and starts the next tracking period.
* Points will no longer be added to the previous tracking period.
* All the employees accomplishments and points are saved in their respective tables to be viewed online.
*/
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

    var activity = "CREATE TABLE IF NOT EXISTS activity_" + connection.escape(periodID) + "(activityID INT AUTO_INCREMENT PRIMARY KEY, coreID VARCHAR(50), accompID INT(3), activity_desc VARCHAR(2500))";
    executeQuery(activity);

    var points = "CREATE TABLE IF NOT EXISTS emp_points_" + connection.escape(periodID) + "(coreID VARCHAR(50), points INT(2))";
    executeQuery(points);

    var employees = "CREATE TABLE `employees_" + connection.escape(periodID) +"` AS SELECT * FROM `employees_" + connection.escape(periodID-1) + "`";
    connection.query(employees, function(err, result) {
      if (err) throw err;
      var zeroPoints = "UPDATE `employees_" +connection.escape(periodID) +"` SET `total_points`=" + 0;
      connection.query(zeroPoints, function(err, result) {
        if (err) throw err;
        sortsortEmps();
        res.send("Success");
      });
    });
  });
});

/**
* Accessed through the admin page.
* Used for uploading a .csv file containing the employees that are participating in the innovation program.
* This file should be delimited by commas (,) and should contain the employees' name, coreID, job, and supervisor/manager.
* In the event that the .csv file's formmating is changed instructions are commented below to help edit the code.
*/
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
        for(let row = 2; row < data.length; row++){
          /* THESE ARE THE LINES TO EDIT INCASE THE CSV FILES FORMATTING IS CHANGED. */
          var insert = "INSERT INTO `employees_" + connection.escape(periodID) + "` (`emp_name`, `coreID`, `job`, `supervisor`, `total_points`) VALUES ("
          insert += connection.escape(data[row][0]) /*<- 0 is the column with the employees name*/+ "," +connection.escape(data[row][4])/*<- 4 is the column with the employees unique ID*/ + ","
          insert += connection.escape(data[row][6]) /*<- 6 is the column with the employees job*/+ "," + connection.escape(data[row][9]) /*<- 9 is the column with the employees manager*/ + "," + 0 /*<- this is the default point value you do not need to change this*/ +")";
          /*FINSIH EDITTING*/
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
      setTimeout(function(){sortsortEmps(periodID);}, 4500);
      setTimeout(function(){return res.redirect('/admin');}, 6010);
    });
  });

});
/**
*
*/
app.post('/findManager', function(req, res){
  var coreID = req.body.CORE_ID;
  var employee = findPersonByID(coreID, alllfaris[periodID], []);
  if(employee[0] != null){
    res.send(employee[0].name);
  } else{
    res.send("Invalid ID");
  }
});

app.post('/getPeriods', function(req, res){
  var theOptions = "";
  for (var [key,value] of pastPeriods) {
    //<option value="1">Choose your Acomplisment</option>
    theOptions += "<option value='" + key + "'>" + value +"</option>";
  }
  console.log(pastPeriods);
  console.log(theOptions);
  res.send(theOptions);
});

app.post('/viewPoints', function(req, res) {
  var empID = req.body.CORE_ID;
  var thePeriod = req.body.PERIOD;
  console.log(thePeriod)
  var personAccomps = [];

  var results = [];
  var query = "SELECT * FROM `activity_" + thePeriod + "` WHERE coreID="+ connection.escape(empID);
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
    response[3] = null;
    response[4] = null;
    var team = findPersonByID(empID, alllfaris[thePeriod], []);

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
          var theEmp = team[0].employeeList[emps];
          if(theEmp.coreID != empID){
            if(theEmp.total_points >= REQUIREDPOINTS){
              response[1] += "<tr><td>" + theEmp.name + "</td><td>" + theEmp.coreID+ "</td><td style='color:#46EF62;'>" + theEmp.total_points + '</td><td><input type="button" id="' + theEmp.coreID + '" onclick="showMoreDetails(this)" value="View"/></td>';
            }
            else{
              response[1] += "<tr><td>" + theEmp.name + "</td><td>" + theEmp.coreID+ "</td><td style='color:#FD4343;'>" + theEmp.total_points + '</td><td><input type="button" id="' + theEmp.coreID + '" onclick="showMoreDetails(this)" value="View"/></td>';
            }
          }
        }
        response[1] += "</tbody></table>";
      }
      if(team[2].employeeList.length > 0){
        response[2] = "<h4>Your Employees</h4><table width='100%' style='margin:0px; padding: 0;'><tbody><tr><th style='text-align:center;'>Name</th><th style='text-align:center;'>Core ID</th><th style='text-align:center;'>Total Points</th><th style='text-align:center;'>Show More Details</th></tr>";

        var needed = team[2].employeeList.length * REQUIREDPOINTS;
        var total = 0;

        for(emp in team[2].employeeList){
          var theEmp2 = team[2].employeeList[emp];
          if(theEmp2.total_points <= REQUIREDPOINTS)
          {
            total += theEmp2.total_points;
          }
          else {
            total += REQUIREDPOINTS;
          }
          if(theEmp2.total_points >= REQUIREDPOINTS){
            response[2] += "<tr><td>" + theEmp2.name + "</td><td>" + theEmp2.coreID+ "</td><td style='color:#46EF62;'>" + theEmp2.total_points + '</td><td><input type="button" id="' + theEmp2.coreID + '" onclick="showMoreDetails(this)" value="View"/></td>';
          }
          else{
            response[2] += "<tr><td>" + theEmp2.name + "</td><td>" + theEmp2.coreID+ "</td><td style='color:#FD4343;'>" + theEmp2.total_points + '</td><td><input type="button" id="' + theEmp2.coreID + '" onclick="showMoreDetails(this)" value="View"/></td>';
          }
        }
        var incomplete = needed - total;
        response[2] += "</tbody></table>";
        response[3] = incomplete;
        response[4] = total;
      }
    }
    else{
      response[0] = "Please Enter a Valid ID";
      response[1] = null;
      response[2] = null;
      response[3] = null;
      response[4] = null;
      response[5] = null;
      response[6] = null;
    }
      res.send(response);
  },700);
});

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
      for(emp in alllall_people[periodID]){
        if((alllall_people[periodID])[emp].coreID === CORE_ID){ (alllall_people[periodID])[emp].total_points += newPoints; }
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

        var updateEmployeePoints = "UPDATE `employees_" + connection.escape(periodID) + "` SET `total_points` = `total_points` + " + newPoints + " WHERE `coreID` = " + connection.escape(CORE_ID);
        executeQuery(updateEmployeePoints);
      });
    }, 700);
    res.send("");
  }
  else{
    res.send("Failure");
  }
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
    if(res.length != 0){
      faris.name = res[0].emp_name;
      faris.coreID = res[0].coreID;
      faris.job = res[0].job;
      faris.supervisor = res[0].supervisor;
      faris.employeeList = [];
      faris.total_points = res[0].total_points;
    }
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

function recurseList(person,thePeople){
  for(val in thePeople)
  {
    if(thePeople[val].supervisor === person.name)
    {
      person.employeeList.push(thePeople[val]);
      recurseList(thePeople[val], thePeople);

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

function getAllPeriods(){
  var getThePeriods = "SELECT * FROM `period`";
  connection.query(getThePeriods, function(req, res){
    if(res.length != 0){
      for(var i = res.length-1; i >= 0; i--){
        pastPeriods.set(res[i].periodID, res[i].name);
      }
    }
  });
}

function sortsortEmps(tempPeriod){
  //Getting faris from the database by his 'emp_name'
  var get_faris = "SELECT * FROM `employees_" + connection.escape(tempPeriod) + "` WHERE `emp_name` = 'Habbaba, Mr. Faris S (Faris)'";
  var tempfaris = new Emp("","","","","0");
  connection.query(get_faris, function(err, res) {
    if (err) throw err;
    if(res.length != 0){
      tempfaris.name = res[0].emp_name;
      tempfaris.coreID = res[0].coreID;
      tempfaris.job = res[0].job;
      tempfaris.supervisor = res[0].supervisor;
      tempfaris.employeeList = [];
      tempfaris.total_points = res[0].total_points;
    }
  });

  //Getting all the employees into a list(all_people)
  var get_all = "SELECT * FROM `employees_" + connection.escape(tempPeriod) + "`";
  var tempall_people = [];
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
      tempall_people.push(person);
    }
  });
  setTimeout(function(){recurseList(tempfaris,tempall_people); },2000);
  setTimeout(function(){
    alllall_people[tempPeriod] = tempall_people;
    alllfaris[tempPeriod] = tempfaris;
  },3000);
}

function getAllPeoplePeriods(){
  alllall_people = [];
  alllfaris = [];
  for(var key of pastPeriods.keys()){
    sortsortEmps(key);
  }
}

function startApplication(){
  handleDisconnect();

  setTimeout(function(){getPeriodID();}, 2000);
  setTimeout(function(){getAllPeriods();}, 3500);
  setTimeout(function(){getAllPeoplePeriods();}, 4000);
}

var server = app.listen(3005, "localhost", function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening at http://%s:%s", host, port);
});
//Calling the main function below
startApplication();
