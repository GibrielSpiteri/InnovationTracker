//Retreiving the neccessary imports below
/**
*When installing the application for the first time,
*Open command line and navigate to where you installed this app
*Type the command: npm install
*This will install all the neccessary node modules
*/
const mysql      = require('mysql'); // Database
const express    = require('express'); // Node framework for app requests
const session    = require('express-session'); // For creating session variables to access admin page
const ejs        = require('ejs'); // JavaScript enabled html pages
const bodyParser = require('body-parser'); // Used for parsing data in html pages
const multer     = require('multer'); // Allows for the transfer of files and imagesfrom html to server
const nodemailer = require('nodemailer'); // Send emails through a bot
const schedule   = require('node-schedule'); // Schedule the emails to be sent
const path       = require('path'); // For creating a public download page to share between client and server
const csvParser  = require('csv-parse'); // Parses csv files
const fs         = require('fs'); // Filereader
const passHash   = require('password-hash'); // Hashes passwords for safe storage
const $ = jQuery = require('jQuery'); // Advanced JavaScript functionality through jQuery


//Creating the Employee class
function Emp(name, coreID, job, supervisor, employeeList, total_points){
  this.name         = name;
  this.coreID       = coreID;
  this.job          = job;
  this.supervisor   = supervisor;   // Who supervises this employee
  this.employeeList = employeeList; // Who this employee supervises
  this.total_points = total_points; // How many points an employee accumulated
}

//Defining Global Variables along with Constant Variables
var all_people             = []; // all the employees in the current and past periods
var allfaris               = []; // Tree of all employees Faris supervises and the employees those people supervise
var tempfaris              = []; // fills the allfaris array
var allEmployeesUnderFaris = []; // Used to split groups of employees into batches of 100 for emailing
var splitListOfPeople      = []; // Batch of 100s
var response               = []; // mail response
var accomDescriptions      = []; // The accomplishments in the dropdown menu
var accomPoints            = []; // The point values accociated with every achievement
var faris                  = new Emp("","","","","0"); // Starting node for the tree creation
var pastPeriods            = new Map(); // The history of the Innovation metric
var logged_in              = false; // Admin login boolean
var periodID               = null;  // The current running period
var connection; // Connection to database
var sesh;       // Admin login session
const DOWNLOAD_FOLDER      = './public/downloads/' // Where to download files


/* Change this value if the required points CHANGED*/
const REQUIREDPOINTS = 8; // Total number of Points every employee must complete before the end of the year


//Setting up the application
var app = express();
app.use(express.static(path.join(__dirname, '/public'))); // public directory
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use(session({secret:'Innovate'}));
app.set('view engine', 'ejs'); // Use .ejs files for HTML
var StatusEnum = Object.freeze({"open":1, "closed": 2});

/*Declare how multer will handle downloading .csv files*/
var storage = multer.diskStorage({
  destination:DOWNLOAD_FOLDER,
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + '.csv')
  }
});
var upload = multer({storage:storage});

// Mailing bot
var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'Zebra.mail.bot@gmail.com', // Your email id
    pass: '^.j\"gk)253{j]hCJr&gZ9N\'^Th5Fh3V9/K5gU^7aW64whrn(xwB+TksM)9ZQ'
  }
});



/*Auto Reset the period - Occurs every January 1st*/
var yearlyReset = schedule.scheduleJob('0 0 1 1 *', function(){
  resetPeriod();
});

/**
*Send email reminders to every group of 100
*/
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



/*------------------------------APP GET REQUESTS------------------------------*/

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
* Directs the user to the admin panel when they are successfully logged in. ~ admin_page.ejs
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



/*------------------------------APP POST REQUESTS-----------------------------*/

/**
* Logs out the admin and sends them back to the login page
*/
app.post("/logout", function(req, res){
  sesh = req.session;
  sesh.logged_in = false;
  sesh.username = "";
  return res.redirect("/login");
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

  // Error checks
  if(sesh.logged_in)
  {
    if(repeatPass.length == 0 || newPass.length == 0)
      res.send("length");
    else{
      if(newPass == repeatPass){
        if(newPass != currPass){
          //Store username in future and use that as reference
          var passCheck = "SELECT `password` FROM `admin` WHERE `username`="+connection.escape(sesh.username);
          connection.query(passCheck, function(err, result){
            if (err) throw err;
            if(passHash.verify(currPass, result[0].password)){
              var hashNewPass = passHash.generate(String(newPass));
              var updatePass = "UPDATE `admin` SET `password`=" + connection.escape(hashNewPass) + "WHERE `username`=" + connection.escape("admin");
              connection.query(updatePass, function(err, result) {
                if (err) throw err;
                res.send("Success");
              });
            }
            // Send proper response
            else{
              res.send("FailureCurrent");
            }
          });
        }else {
          res.send("SameChange")
        }
      }
      else{
        res.send("FailureRepeat");
      }
    }
  }
});

/**
* Accessed through the admin page.
* This function manually ends the current tracking period and starts the next tracking period.
* Points will no longer be added to the previous tracking period.
* All the employees accomplishments and points are saved in their respective tables to be viewed online.
*/
app.post('/resetTables', function(req,res){
  var periodName = req.body.periodName;
  resetTables(periodName);
});


/**
* Accessed through the admin page.
* This function allows the admin to manually enter in a new accomplishment for employees to select
*/
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

/**
* Accessed through the admin page.
* This function allows the admin to manually remove an accomplishment from being displayed on the main page
*/
app.post('/deleteAccomplishments', function(req,res){
  var deleteID = req.body.ID
  //The query does not permanently delete the accomplishment as there are issues with displaying points when doing so
  //Instead the accomplishment is disabled (enabled field set to 0) and is saved in the table
  var queryAccomps = 'UPDATE `accomplishment` SET `enabled`= 0 WHERE `accompID`=' + connection.escape(deleteID);
  connection.query(queryAccomps, function(err, result) {
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

/**
* Accessed through the admin page.
* Writes the table to delete accomplishments to the admin page
*/
app.post('/deleteAccomplishmentsTable', function(req,res){
  var htmlResponse = '</br><table class="table table-striped table-hover table-responsive"><tr><th style="text-align:center;">Description</th><th>Points</th><th>Remove Item</th></tr>';
  var queryAccomps = 'SELECT * FROM `accomplishment`';
  connection.query(queryAccomps, function(err, result) {
    for(item in result){
      if(item != 0 && result[item].enabled != 0){
        htmlResponse += '<tr><td>' + result[item].description + '</td><td>' + result[item].points + '</td><td><img data-toggle="modal" data-target="#deleteAlert" onclick="deleteAccomplishment(' + result[item].accompID + ')" src="/delete.png" height="25px" width="25px" style="cursor: pointer;"/></td></tr>';
      }
    }
    htmlResponse += '</table>';
    res.send(htmlResponse);
  });
});

/**
* Accessed through the admin page.
* Used for uploading a .csv file containing the employees that are participating in the innovation program.
* This file should be delimited by commas (,) and should contain the employees' name, coreID, job, and supervisor/manager.
* In the event that the .csv file's formmating is changed instructions are commented below to help edit the code.
*/
app.post('/add_csv', upload.single('fileUpload'), function(req, res) {
  var theFile = __dirname + "\\public\\downloads\\" + req.file.filename;

  console.log(theFile);
  fs.readFile(theFile, {
    encoding: 'utf-8'
  }, function(err, csvData) {
    if (err){
      res.end("Error Reading File");
      //throw err;
    }
    csvParser(csvData, {
      delimiter: ','
    }, function(err, data) {
      if (err) {
        res.end("Error Parsing File");
        //throw err;
      }
      else {
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
        // For the employees still in the table, give them back their points
        setTimeout(function(){
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
        },2000);
      }
      setTimeout(function(){
        sortsortEmps(periodID); // Sort the arrays again after an upload
        return res.end("File Upload Successful");
      }, 6000);
    });
  });
});

/**
* When a user enters their ID into the add points page
* the system searches for their manager and name
*/
app.post('/findInformation', function(req, res){
  var coreID = req.body.CORE_ID.toUpperCase();
  var employee = findPersonByID(coreID, allfaris[periodID], []);
  var information = [];
  if(employee[0] != null){
    information[0] = refinedName(employee[1]);
    information[1] = refinedName(employee[0].name);
  } else{
    information[0] = "Invalid ID";
    information[1] = "Invalid ID";
  }
  res.send(information);
});

/**
* This function gets all the accomplishment types from the database
*/
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
        if(result[item].enabled == 1){
          customGoesLast = result[item];
        }
      }
      else{
        if(result[item].enabled == 1){
          htmlResponse += '<option value="' + result[item].accompID +'">' + result[item].description +'(' + result[item].points + ')' + '</option>';
        }
      }
    }
    if(customGoesLast != ''){
      htmlResponse += '<option value="' + customGoesLast.accompID +'">' + customGoesLast.description +'(' + customGoesLast.points + ')' + '</option>';
    }
    htmlResponse += '</select>';
    res.send(htmlResponse);
  });
});

/**
* Sends five people with the highest point count to the leaderboard tab in index.ejs
*/
app.post('/leaderboard', function(req, res){
  var everyonesPoints = [];
  var scoreboard = [];
  for(emp in all_people[periodID]){
    everyonesPoints.push(all_people[periodID][emp]);
  }
  everyonesPoints.sort(compareValues('total_points', 'desc'));
  for(var i = 0; i < 5; i++){
    if(everyonesPoints[i] != null && everyonesPoints[i].total_points != null && everyonesPoints[i].total_points > 0){
      var refinedEmpName = refinedName(everyonesPoints[i].name);
      scoreboard[i] = [everyonesPoints[i].total_points, refinedEmpName]
    }
    else{
      scoreboard[i] = [null, null];
    }
  }
  res.send(scoreboard);
});

/**
* Sends all the periods to the view points tab period selector in index.ejs
*/
app.post('/getPeriods', function(req, res){
  var theOptions = "";
  for (var [key,value] of pastPeriods) {
    theOptions += "<option value='" + key + "'>" + value +"</option>";
  }
  res.send(theOptions);
});

/**
* When a user submits their ID on the view points tab this function is called
* The function creates three tables to display the employees personal accomplishments,
* Their groups accomplishments, and their employees accomplishments if they're a supervisor
*/
app.post('/viewPoints', function(req, res) {
  console.log("All People: " + all_people[1].length);

  var empID = req.body.CORE_ID.toUpperCase();
  var thePeriod = req.body.PERIOD;
  var personAccomps = [];
  var results = [];
  var query = "SELECT * FROM `activity_" + thePeriod + "` WHERE coreID="+ connection.escape(empID);
  connection.query(query, function(err, activities) {
    if (err) throw err;
    for(whatTheEmpDid in activities)
    {
      personAccomps.push(activities[whatTheEmpDid]); // Get the employees completed activities
    }
  });

  setTimeout(function(){
    parseAccomplishments(personAccomps); // Get the point value and description of the accomplishment
  },500);

  setTimeout(function(){ // Create the htmlresponse - all the table data
    var pointCount = 0;
    response[0]    = null;
    response[1]    = null;
    response[2]    = null;
    response[3]    = null;
    response[4]    = null;
    var team = findPersonByID(empID, allfaris[thePeriod], []); // find the employee and their information
    //Write the personal accomplishments table
    if(team[0] != null){
      response[5] = "<h4>Name: " + refinedName(team[1]) + "</h4><h4>Manager: " + refinedName(team[0].name) + "</h4></br>";
      response[0] = "<table class='table table-striped table-hover table-responsive'><thead class='thead-dark'><tr style='vertical-align:middle;'><th style='text-align:center; width:35%'>Accomplishment</th><th style='text-align:center; width:40%'>Description</th><th style='text-align:center; width:10%'>Points</th><th style='text-align:center; width:9%'>Delete</th></tr></thead><tbody>";
      for(val in personAccomps)
      {
        response[0] += "<tr><td style='text-align:center;'>" + accomDescriptions[val] + "</td><td style='text-align:center; word-break:break-all;'>" + personAccomps[val].activity_desc + "</td><td style='text-align:center;'>" + accomPoints[val]+ "</td><td><input type='image' onclick='removeAcheivement("+ personAccomps[val].activityID +"," + personAccomps[val].accompID +")' data-toggle='modal' data-target='#deleteAlert' src='/delete.png' style='width:25px; height:25px' /></td></tr>";
        pointCount += accomPoints[val];
      }
      response[0] += "<tr style='vertical-align:middle;'><td></td><td><h4 style='text-align: right;'>Total Points</h4></td><td style='text-align:center; vertical-align:middle;'>"
      response[0] += pointCount;
      response[0] += "</td><td></td></tr>";
      response[0] += "</tbody></table";

      // Create the your group table
      if(team[0].employeeList != null){
        response[1] = "<table width='100%' style='margin:0px; padding: 0;' class='table table-striped table-hover table-responsive'><thead class='thead-dark'><tr><th style='text-align:center; width: 35%;'>Name</th><th style='text-align:center; width: 25%;'>Core ID</th><th style='text-align:center; width: 15%;'>Total Points</th><th style='text-align:center; width: 25%;'>Show More Details</th></tr></thead><tbody>";
        for(emps in team[0].employeeList){
          var theEmp = team[0].employeeList[emps];
          if(theEmp.coreID != empID){
            if(theEmp.total_points >= REQUIREDPOINTS){
              response[1] += "<tr><td>" + refinedName(theEmp.name) + "</td><td>" + theEmp.coreID+ "</td><td style='color:#46EF62;'>" + theEmp.total_points + '</td><td><input type="image" id="' + theEmp.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td></tr>';
            }
            else{
              response[1] += "<tr><td>" + refinedName(theEmp.name) + "</td><td>" + theEmp.coreID+ "</td><td style='color:#FD4343;'>" + theEmp.total_points + '</td><td><input type="image" id="' + theEmp.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td></tr>';
            }
          }
        }
        response[1] += "</tbody></table>";
      }

      // Create the your employees table
      if(team[2].employeeList.length > 0){
        response[2] = "<table width='100%' style='margin:0px; padding: 0;' class='table table-striped table-hover table-responsive'><thead class='thead-dark'><tr><th style='text-align:center; width: 35%;'>Name</th><th style='text-align:center; width: 25%;'>Core ID</th><th style='text-align:center; width: 15%;'>Total Points</th><th style='text-align:center; width: 25%;'>Show More Details</th></tr></thead><tbody>";

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
            response[2] += "<tr><td>" + refinedName(theEmp2.name) + "</td><td>" + theEmp2.coreID+ "</td><td style='color:#46EF62;'>" + theEmp2.total_points + '</td><td><input type="image" id="' + theEmp2.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td></tr>';
          }
          else{
            response[2] += "<tr><td>" + refinedName(theEmp2.name) + "</td><td>" + theEmp2.coreID+ "</td><td style='color:#FD4343;'>" + theEmp2.total_points + '</td><td><input type="image" id="' + theEmp2.coreID + '" onclick="showMoreDetails(this)" src="/search_person.svg" style="padding-left:20px; padding-right:20px;"/></td></tr>';
          }
        }
        var incomplete = needed - total;
        response[2] += "</tbody></table>";
        response[3] = incomplete;
        response[4] = total;
      }
    }
    else{ // If the id was invalid send an invalid response
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

/**
* Allows a user to remove an achievement from th personal achievement table
*/
app.post('/removeAcheivement', function(req, res) {
  var activityID = req.body.ACTIVITYID;
  var accompID = req.body.ACCOMPID;
  var selectPoints = "SELECT `points` FROM `accomplishment` WHERE `accompID`=" + connection.escape(accompID);
  connection.query(selectPoints, function(err, result) {
    if(err) {
      res.end(false);
    }
    else{
      var thePoint = result[0].points;

      var getCoreId = "SELECT `coreID` FROM `activity_"+ connection.escape(periodID) +"` WHERE `activityID`=" + connection.escape(activityID);
      connection.query(getCoreId, function(err, result) {
        if(err) throw err;
        var theID = result[0].coreID;
        for(var emp in all_people[periodID]){
          if(all_people[periodID][emp].coreID == theID){
            all_people[periodID][emp].total_points = all_people[periodID][emp].total_points - thePoint;
          }
        }
        // Update tables
        var updateEmpPoints = "UPDATE `emp_points_"+ connection.escape(periodID) +"` SET `points` = `points`" + (-thePoint) + " WHERE `coreID` = " + connection.escape(theID);
        var updateEmployee = "UPDATE `employees_"+ connection.escape(periodID) +"` SET `total_points` = `total_points`" + (-thePoint) + " WHERE `coreID` = " + connection.escape(theID);
        var deleteActivity = "DELETE FROM `activity_"+ connection.escape(periodID) +"` WHERE activityID = " + connection.escape(activityID);
        executeQuery(deleteActivity);
        executeQuery(updateEmployee);
        executeQuery(updateEmpPoints);
        res.send(true)
      });
    }
  });
});


/**
* Lets a user add an achievement to their ID
*/
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
      for(emp in all_people[periodID]){
        if((all_people[periodID])[emp].coreID === CORE_ID){ (all_people[periodID])[emp].total_points += newPoints; }
      }
      var ID_Check = "SELECT `coreID` FROM `emp_points_" + connection.escape(periodID) + "` WHERE `coreID` = "  + connection.escape(CORE_ID);
      connection.query(ID_Check, function(err, result) {
        if (err) throw err;
        if(result.length == 0){
          var newEmpPoints = "INSERT INTO `emp_points_" + connection.escape(periodID) + "` (`coreID`, `points`) VALUES (" + connection.escape(CORE_ID)+ ","+ newPoints +")";
          executeQuery(newEmpPoints);
        }
        else{
          var points = "UPDATE `emp_points_" + connection.escape(periodID) + "` SET `points`=`points` +" + newPoints + " WHERE `coreID`=" + connection.escape(CORE_ID);
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


/*----------------------------------FUNCTIONS---------------------------------*/

/**
* Retrieves the Description and Points associated with an accomplishment
* @param {Array} personAccomps A list of all the activities an  employee completed
*/
function parseAccomplishments(personAccomps){
  accomDescriptions = []; // global variables
  accomPoints = [];       // These are what is sent to view points

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

/**
* Gets the period ID of the current years period
*/
function getPeriodID(){
  var getCurrentPeriod = "SELECT `periodID` FROM `period` WHERE `currentPeriod`=TRUE"
  connection.query(getCurrentPeriod, function(err, res) {
    if (err) throw err;
    periodID = res[0].periodID;
  });
}

/**
* Sorts the Employees by their total points for display in the leaderboard
*/
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

/**
* Queries the database for the employee table with the given periodID
* Then sorts all the employees under Faris' heirarchy chain into the all_people array
* @param {Int} tempPeriod The current innovation metric period used to query the database
*/
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
    all_people[tempPeriod] = tempall_people;
    allfaris[tempPeriod] = tempfaris;
  },3000);
}

/**
* Console logs everyone under faris
*/
function printFaris(farisObject){
  console.log(farisObject.name);
  printTree(farisObject, 0);
}

/**
* Recursively calls itself until it finds the given person it is searching for
*/
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

/**
* Pretty prints everyone under Faris
*/
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

/**
* Finds an employee under Faris by searching for their ID recursively
* @param {String} coreID The ID of the person we are searching for
* @param {Emp} person The supervisor that's expanded into their employees, starts with Faris
* @param {Array} result The results of the search, contains the supervisor of the searched person, their name, and their employees
*/
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

/**
* Queries the periods table to retrieve every period from the past
*/
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

/**
* Removes the orginal name formatting
* Lastname, Firstname (Nickname) -> Firstname Lastname
* @param {String} name The Name of the person we are formatting
*/
function refinedName(name){
  var refinedNames;
  if(name.indexOf(",") >= 0){
    refinedNames = name.split(", ");
    refinedNames = refinedNames[1] + " " + refinedNames[0];
  }
  if(refinedNames.indexOf("(") >= 0 && refinedNames.indexOf(")") >= 0){
    refinedNames = refinedNames.substring(0, refinedNames.indexOf("(")) + refinedNames.substring(refinedNames.indexOf(")")+2, refinedNames.length)
  }
  return refinedNames;
}

/**
* Automatically resets all the database tables - calls resetTables()
*/
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

/**
* Sends the Emails to the batches
*/
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
        //to: email, // list of receivers
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

/**
* Email a batch of employees
* @param {Int} groupNumber The group being emailed
*/
function sendMonthlyEmailToGroup(groupNumber){
  var employeeEmailList = splitListOfPeople[groupNumber];
  for(employeeEmail in employeeEmailList){
    var refinedEmpName = refinedName(employeeEmailList[employeeEmail].name);
    var coreID = employeeEmailList[employeeEmail].coreID;
    sendCheckInnovationEmail(refinedEmpName, coreID, (3000*employeeEmail));
    // sendCheckInnovationEmail("Herrmann, Mr. Jeremy", "DCW673");
  }
  console.log("List Size: " + employeeEmailList.length);
}

/**
* Create a group of employees for emailing (up to 500 people)
*/
function createSplitListOfEmployees(){
  for(var x = 0; x < 5; x++)
    splitListOfPeople[x] = [];
  for(var x = 0; x < allEmployeesUnderFaris.length; x++)
  {
    splitListOfPeople[Math.floor(x/100)].push(allEmployeesUnderFaris[x]);
  }
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
* `period` - Stores the period ID (used for querying other tables), the name of the period, when it started, when it ended, and a boolean value declaring if it is the active period
* `activity_[periodID]`   - When an employee adds points to their score this is where it is saved, the coreID of the employee, the accomplishment they completed, and the description they gave is saved here
* `emp_points_[periodID]` - This table keeps a record of how many points an employee has for the event when there is a new csv uploaded. This table is a way to prevent any mistakes from wiping all the employee data.
* `employees_[periodID]`  - Stores the data from the csv file. Keep in mind all the employees are saved in this table from the file not just employees under Faris, we later refine the data to be only those under Faris.
* 'accomplishments'       - Saves a list of all the accomplishments an employee can complete, written below are the default accomplishments. New ones can be added and deleted from the admin page.
* `admin`                 - Contains the admin's hashed password.
*/
function initializeTables(){

  var period = "CREATE TABLE IF NOT EXISTS period(periodID INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(25), startTime DATETIME, endTime DATETIME, currentPeriod BOOLEAN)";
  executeQuery(period);
  var firstPeriod = "SELECT * FROM `period`";
  connection.query(firstPeriod, function(err, result) {
    if(result.length == 0){
      var current_date = new Date();
      var current_year = current_date.getFullYear();
      var next_year = current_year+1;
      var periodName = current_year + " - " + next_year;
      var makeFirstPeriod = "INSERT INTO `period` (`name`, `startTime`, `currentPeriod`) VALUES ('" + periodName + "', NOW(), TRUE)";
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

  var accomplishments = "CREATE TABLE IF NOT EXISTS `accomplishment`(`accompID` INT AUTO_INCREMENT PRIMARY KEY NOT NULL, `description` VARCHAR(2500) NOT NULL, `points` INT(2) NOT NULL, `enabled` TINYINT(4) NOT NULL DEFAULT 1)";
  executeQuery(accomplishments);
  var checkAccomps = "SELECT * FROM `accomplishment`";
  connection.query(checkAccomps, function(err, result) {
    if(result == 0){
      var insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (1,'Choose your Acomplisment',0,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (2,'Identify a meaningful problem that needs a solution',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (3,'Identify a new product feature for the backlog',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (4,'Attend a Lunch and Learn',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (5,'Submit abstract for ZTS Expo or Srjana',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (6,'Attend a readout from a customer visit',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (7,'Attend JDM Expo, Innovation showcase, Intern project review',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (8,'Peer review an IP disclosure - witness, read and understand',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (9,'Join ETO Techspresso event',1,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (10,'Take part in brain storming session',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (11,'Help someone get their first patent disclosure submitted',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (12,'Solve a problem and implement the solution',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (13,'Mentoring inventors for success',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (14,'Teach a class, lead a Lunch and Learn, lead a techtalk, or developer conf',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (15,'Organize and run a brainstorming session',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (16,'Visit a customer and present findings',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (17,'Supervise a summer intern on one of their projects',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (18,'Collaborate across BUs for Differentiation and efficency opportunities',2,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (19,'Submit a peer reviewed IP disclosure - Phase 1',4,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (20,'Patent Committee decides to pursue your submission - Phase 2',4,1);";
      executeQuery(insertBasicAccomp);
      insertBasicAccomp = "INSERT INTO `accomplishment` (`accompID`,`description`,`points`,`enabled`) VALUES (21,'[CUSTOM]',1,1);";
      executeQuery(insertBasicAccomp);
    }
  });
  var admin_login = "CREATE TABLE IF NOT EXISTS `admin`(username VARCHAR(25), password VARCHAR(100))";
  connection.query(admin_login, function(err, result) {
    if (err) throw err;
    //Default account when the table is first created, it is recommended to update the password when you login.
    var selectAdmin ="SELECT * FROM `admin`";
    connection.query(selectAdmin, function(err, result){
      if(err) throw err
      if(result.length == 0){
        var new_admin = "INSERT INTO `admin` (`username`, `password`) VALUES ('admin', 'sha1$5c533d80$1$5acc18ff74b44a3c9ac0308e78836e83a73eb9e0')";
        executeQuery(new_admin);
      }
    });
  });
}

/**
* The queries that reset all the tables and creates a new tracking period
* @param {String} periodName The name of the new period
*/
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
* Sorts every employee from every past period
*/
function getAllPeoplePeriods(){
  all_people = [];
  allfaris = [];
  for(var key of pastPeriods.keys()){
    sortsortEmps(key);
  }
}

/**
* Get a list of everyone under Faris for emailing
*/
function makeListOfAllPeopleUnderFaris(){
  var currentFaris = allfaris[periodID];
  addToUnderFarisList(currentFaris);
}

/**
* Add to the list for emailing
*/

function addToUnderFarisList(person){
  //console.log(person);
  allEmployeesUnderFaris.push(person);
  for(emp in person.employeeList)
  {
    addToUnderFarisList(person.employeeList[emp]);
  }
}

/**
* Attempts to connect to the database and initialize the tables - Will continue to do this until successful
*/
function handleDisconnect() {
  // Establish database connection
  connection = mysql.createConnection(db_config);
  connection.connect((err) => {
    // if it fails try again every two seconds
    if (err) {
      console.log('Error connecting to db', err);
      setTimeout(handleDisconnect, 2000);
    }
    // On success initialize tables
    console.log('Connected');
    initializeTables();
  });

  // If we run into an error try to re-establish connection
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
* Listen to the IP:Port
*/
var server = app.listen(3005, "10.61.32.135", function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log("Listening at http://%s:%s", host, port);
});

/**
* Runs the necessary functions to start the application
*/
function startApplication(){
  // Connect to DB
  handleDisconnect();
  // Get current period
  setTimeout(function(){getPeriodID();}, 2000);
  // Get the past periods
  setTimeout(function(){getAllPeriods();}, 3500);
  // Sort all the employees
  setTimeout(function(){getAllPeoplePeriods(); }, 4000);

}
//Calling the main function below
startApplication();
