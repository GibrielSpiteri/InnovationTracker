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
var schedule = require('node-schedule');
// require('./jquery-csv/src/jquery.csv.js');


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
var allall_people = [];
var allfaris = [];
var allEmployeesUnderFaris = [];
var splitListOfPeople = [];
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
var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'Zebra.mail.bot@gmail.com', // Your email id
    pass: '^.j\"gk)253{j]hCJr&gZ9N\'^Th5Fh3V9/K5gU^7aW64whrn(xwB+TksM)9ZQ'
  }
});
var upload = multer({storage:storage})


//Occurs every January 1st
// var j = schedule.scheduleJob('0 * * * *', function(){
var yearlyReset = schedule.scheduleJob('0 0 1 1 *', function(){
  resetPeriod();
});

var monthlyEmailGroupOne = schedule.scheduleJob('0 0 1 * *', function(){
  makeListOfAllPeopleUnderFaris();
  createSplitListOfEmployees();
  sendMonthlyEmailToGroup(0);
});

var monthlyEmailGroupTwo = schedule.scheduleJob('0 0 2 * *', function(){
  sendMonthlyEmailToGroup(1);
});

var monthlyEmailGroupThree = schedule.scheduleJob('0 0 3 * *', function(){
  sendMonthlyEmailToGroup(2);
});

var monthlyEmailGroupFour = schedule.scheduleJob('0 0 4 * *', function(){
  sendMonthlyEmailToGroup(3);
});

var monthlyEmailGroupFive = schedule.scheduleJob('0 0 5 * *', function(){
  sendMonthlyEmailToGroup(4);
});

//Defining the settings for the database - Will have to change this when moving the server to AWS or Savahnna
const db_config = {
  host: '10.61.32.135',
  port: '3306',
  user: 'root',
  password: 'Zebra123',
  database: 'kiosk'
};

function resetPeriod(){
  console.log("Beginning to reset the Innovation Period");
  setTimeout(function(){
    console.log("5")
  }, 1000);
  setTimeout(function(){
    console.log("4")
  }, 2000);
  setTimeout(function(){
    console.log("3")
  }, 3000);
  setTimeout(function(){
    console.log("2")
  }, 4000);
  setTimeout(function(){
    console.log("1")
  }, 5000);
  setTimeout(function(){
    console.log("Resetting Period");
    var current_date = new Date();
    console.log("Current Date : ");
    console.log(current_date);
    console.log("Current Year : " + current_date.getFullYear());
    var current_year = current_date.getFullYear();
    console.log(current_year+1);
    var next_year = current_year+1;
    var periodName = current_year + " - " + next_year;
    console.log(periodName);
    resetTables(periodName);
  }, 6000);
}

function sendCheckInnovationEmail(name, coreID, delay){
  var newName = name;
  var newCoreID = coreID;
  var newDelay = delay;
  setTimeout(function(){
    var findPoints = "SELECT * FROM `employees_" + connection.escape(periodID) + "` WHERE `coreID` = " + connection.escape(newCoreID);
    connection.query(findPoints, function(err, result) {
      if (err) throw err;
      var points = result[0].total_points;
      var content = "No HTML Here"
      var html_content = 'Hello ' + newName + ', this is your monthly innovation score update. You currently have ' + points + ' points and need a total of ' + REQUIREDPOINTS + ' Points.';
      var email = newCoreID + "@zebra.com";
      var mailOptions = {
        from: 'Zebra.mail.bot@gmail.com', // sender address
        // to: email, // list of receivers
        to: "Jeremy.Herrmann@stonybrook.edu",
        subject: 'Monthly Innovation Score Update', // Subject line
        text: content,
        html: html_content
      };
      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log('Message sent: ' + info.response);
        }
      });
    });
  }, newDelay);

}

function sendMonthlyEmailToGroup(groupNumber){
  var employeeEmailList = splitListOfPeople[groupNumber];
  for(employeeEmail in employeeEmailList){
    var name = employeeEmailList[employeeEmail].name;
    var refinedNames = name.split(", ");
    refinedNames = refinedNames[1] + " " + refinedNames[0];
    if(refinedNames.indexOf("(") >= 0){
      refinedNames = refinedNames.substring(0, refinedNames.indexOf("(")) + refinedNames.substring(refinedNames.indexOf(")")+2, refinedNames.length)
    }
    var coreID = employeeEmailList[employeeEmail].coreID;
    sendCheckInnovationEmail(refinedNames, coreID, (3000*employeeEmail));
    // sendCheckInnovationEmail("Herrmann, Mr. Jeremy", "DCW673");
  }
  console.log("List Size: " + employeeEmailList.length);
}

function createSplitListOfEmployees(){
  for(var x = 0; x < 5; x++)
    splitListOfPeople[x] = [];
  for(var x = 0; x < allEmployeesUnderFaris.length; x++)
  {
    splitListOfPeople[Math.floor(x/100)].push(allEmployeesUnderFaris[x]);
  }
}

function displayTree(){
  printFaris(allfaris[periodID]);
}

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
  if(!sesh.logged_in){
    return res.redirect('/login');
  } else {
    res.render('pages/admin_page');
  }
});

app.post("/logout", function(req, res){
  sesh = req.session;
  sesh.logged_in = false;
  sesh.username = "";
  return res.redirect("/");
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

function resetTables(periodName){
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
      });
    });
  });
}

/**
* Accessed through the admin page.
* This function ends the current tracking period and starts the next tracking period.
* Points will no longer be added to the previous tracking period.
* All the employees accomplishments and points are saved in their respective tables to be viewed online.
*/
app.post('/resetTables', function(req,res){
  var periodName = req.body.periodName;
  resetTables(periodName);
});

function compareValues(key, order='asc') {
  return function(a, b) {
    if(!a.hasOwnProperty(key) ||
       !b.hasOwnProperty(key)) {
  	  return 0;
    }

    const varA = (typeof a[key] === 'string') ?
      a[key].toUpperCase() : a[key];
    const varB = (typeof b[key] === 'string') ?
      b[key].toUpperCase() : b[key];

    let comparison = 0;
    if (varA > varB) {
      comparison = 1;
    } else if (varA < varB) {
      comparison = -1;
    }
    return (
      (order == 'desc') ?
      (comparison * -1) : comparison
    );
  };
}



app.post('/leaderboard', function(req, res){
  var everyonesPoints = [];
  var scoreboard = [];
  for(emp in allall_people[periodID]){
    everyonesPoints.push(allall_people[periodID][emp]);
  }
  everyonesPoints.sort(compareValues('total_points', 'desc'));
  for(var i = 0; i < 5; i++){
    if(everyonesPoints[i] != null && everyonesPoints[i].total_points != null && everyonesPoints[i].total_points > 0){
      scoreboard[i] = [everyonesPoints[i].total_points, everyonesPoints[i].name]
    }
    else{
      scoreboard[i] = [null, null];
    }
  }
  res.send(scoreboard);
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
          insert += connection.escape(data[row][0]) /*<- 0 is the column with the employees name*/+ "," +connection.escape(data[row][4].toUpperCase())/*<- 4 is the column with the employees unique ID*/ + ","
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
            var updatePoints = "UPDATE `employees_" + connection.escape(periodID) + "` SET `total_points`=" + thePoints + " WHERE `coreID` = " + connection.escape(coreIDWithPoints.toUpperCase());
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
app.post('/findInformation', function(req, res){
  var coreID = req.body.CORE_ID;
  coreID = coreID.toUpperCase();
  var employee = findPersonByID(coreID, allfaris[periodID], []);
  var information = [];
  if(employee[0] != null){
    information[0] = employee[1];
    information[1] = employee[0].name;
  } else{
    information[0] = "Invalid ID";
    information[1] = "Invalid ID";
  }
  res.send(information);
});

app.post('/getAccomplishments', function(req,res){
  var htmlResponse = '<select class="form-control" id="accomplishment" name="accomplishment">';
  var queryAccomps = "Select * FROM `accomplishment`";
  var customGoesLast = '';
  connection.query(queryAccomps, function(err, result) {
    if (err) throw err;
    for(var item in result){
      if(item == 0){
        htmlResponse += '<option value="' + result[item].accompID +'">' + result[item].description + '</option>';
      }
      else if(result[item].description == "[CUSTOM]"){
        customGoesLast = result[item];
      }
      else{
        htmlResponse += '<option value="' + result[item].accompID +'">' + result[item].description +'(' + result[item].points + ')' + '</option>';
      }
    }
    htmlResponse += '<option value="' + customGoesLast.accompID +'">' + customGoesLast.description +'(' + customGoesLast.points + ')' + '</option>';
    htmlResponse += '</select>';
    res.send(htmlResponse);
  });
});

app.post('/addAccomplishments', function(req,res){
  var insertDescription = req.body.DESCRIPTION;
  var insertPoints = req.body.POINTS;
  var queryAccomps = 'INSERT INTO `accomplishment` (`description`, `points`) VALUES (' + connection.escape(insertDescription) + ',' + connection.escape(insertPoints) + ')';
  connection.query(queryAccomps, function(err, result) {
    if (err){
      res.send(false);
      throw err;
    }
    res.send(true);
  });
});

app.post('/deleteAccomplishments', function(req,res){
  var deleteID = req.body.ID
  var queryAccomps = 'DELETE FROM `accomplishment` WHERE accompID=' + connection.escape(deleteID);

  connection.query(queryAccomps, function(err, result) {
    console.log(result);
    if(err){
      res.send("ERROR");
      throw err;
    }
    if(result.affectedRows <= 0){
      res.send("ERROR");
    }
    else{
      res.send("SUCCESS");
    }
  });
});

app.post('/deleteAccomplishmentsTable', function(req,res){
  var htmlResponse = '</br><table class="table table-striped table-hover table-responsive"><tr><th>Remove Item#</th><th style="text-align:center;">Description</th><th>Points</th></tr>';
  var queryAccomps = 'SELECT * FROM `accomplishment`';
  connection.query(queryAccomps, function(err, result) {
    for(item in result){
      htmlResponse += '<tr><td style="text-align:left" "><input  type="button" onclick="deleteAccomplishment(' + result[item].accompID + ')" value="Remove #' + result[item].accompID + '" style="width:107px"/></td><td>' + result[item].description + '</td><td>' + result[item].points + '</td></tr>';
    }
    htmlResponse += '</table>';
    res.send(htmlResponse);
  });
});


app.post('/getPeriods', function(req, res){
  var theOptions = "";
  for (var [key,value] of pastPeriods) {
    //<option value="1">Choose your Acomplisment</option>
    theOptions += "<option value='" + key + "'>" + value +"</option>";
  }
  res.send(theOptions);
});

app.post('/viewPoints', function(req, res) {
  var empID = req.body.CORE_ID.toUpperCase();
  var thePeriod = req.body.PERIOD;
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
    var team = findPersonByID(empID, allfaris[thePeriod], []);
    if(team[0] != null){
      response[0] = "<table class='table table-striped table-hover table-responsive'><h3>Name: " + team[1] + "</h3><h3>Manager: " + team[0].name + "</h3></br><thead class='thead-dark'><tr><th style='text-align:center;'>Accomplishment</th><th style='text-align:center;'>Description</th><th style='text-align:center;'>Points</th></tr></thead><tbody>";
      for(val in personAccomps)
      {
        response[0] += "<tr><td>" + accomDescriptions[val] + "</td><td style='word-break: break-all;'>" + personAccomps[val].activity_desc + "</td><td text-align:center;'>" + accomPoints[val]+ "</td></tr>";
        pointCount += accomPoints[val];
      }
      response[0] += "<tr><td></td><td><h4 style='text-align: right;'>Total Points</h4></td><td style='text-align:center;'>"
      response[0] += pointCount;
      response[0] += "</td></tr>";
      response[0] += "</tbody></table";
      if(team[0].employeeList != null){
        response[1] = "<table class='table table-striped table-hover table-responsive'><thead class='thead-dark'><tr><th style='text-align:center;'>Name</th><th style='text-align:center;'>Core ID</th><th style='text-align:center;'>Total Points</th><th style='text-align:center;'>Show More Details</th></tr></thead><tbody>";
        for(emps in team[0].employeeList){
          var theEmp = team[0].employeeList[emps];
          if(theEmp.coreID != empID){
            if(theEmp.total_points >= REQUIREDPOINTS){
              response[1] += "<tr><td>" + theEmp.name + "</td><td>" + theEmp.coreID+ "</td><td style='color:#46EF62;'>" + theEmp.total_points + '</td><td><input type="image" id="' + theEmp.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td>';
            }
            else{
              response[1] += "<tr><td>" + theEmp.name + "</td><td>" + theEmp.coreID+ "</td><td style='color:#FD4343;'>" + theEmp.total_points + '</td><td><input type="image" id="' + theEmp.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td>';
            }
          }
        }
        response[1] += "</tbody></table>";
      }
      if(team[2].employeeList.length > 0){
        response[2] = "<table width='100%' style='margin:0px; padding: 0;' class='table table-striped table-hover table-responsive'><thead class='thead-dark'><tr><th style='text-align:center;'>Name</th><th style='text-align:center;'>Core ID</th><th style='text-align:center;'>Total Points</th><th style='text-align:center;'>Show More Details</th></tr></thead><tbody>";

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
            response[2] += "<tr><td>" + theEmp2.name + "</td><td>" + theEmp2.coreID+ "</td><td style='color:#46EF62;'>" + theEmp2.total_points + '</td><td><input type="image" id="' + theEmp2.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td>';
          }
          else{
            response[2] += "<tr><td>" + theEmp2.name + "</td><td>" + theEmp2.coreID+ "</td><td style='color:#FD4343;'>" + theEmp2.total_points + '</td><td><input type="image" id="' + theEmp2.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td>';
          }
        }
        var incomplete = needed - total;
        response[2] += "</tbody></table>";
        response[3] = incomplete;
        response[4] = total;
      }
    }
    else{
      response[0] = "invalid";
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
  var activity = "INSERT INTO `activity_" + connection.escape(periodID) + "` (`coreID`, `accompID`, `activity_desc`) VALUES (" + connection.escape(CORE_ID.toUpperCase()) + "," + connection.escape(ACCOMPLISHMENT) + "," +connection.escape(DESCRIPTION) +");";
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
      for(emp in allall_people[periodID]){
        if((allall_people[periodID])[emp].coreID === CORE_ID){ (allall_people[periodID])[emp].total_points += newPoints; }
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

function printFaris(farisObject){
  console.log(farisObject.name);
  printTree(farisObject, 0);
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
    console.log(tabs + person.employeeList[emp].name);
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
    allall_people[tempPeriod] = tempall_people;
    allfaris[tempPeriod] = tempfaris;
  },3000);
}

function getAllPeoplePeriods(){
  allall_people = [];
  allfaris = [];
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

function makeListOfAllPeopleUnderFaris(){
  var currentFaris = allfaris[periodID];
  addToUnderFarisList(currentFaris);
  //console.log(allEmployeesUnderFaris.length);
}

function addToUnderFarisList(person){
  //console.log(person);
  allEmployeesUnderFaris.push(person);
  for(emp in person.employeeList)
  {
    addToUnderFarisList(person.employeeList[emp]);
  }
}

var server = app.listen(3005, "localhost", function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening at http://%s:%s", host, port);
});
//Calling the main function below
startApplication();
