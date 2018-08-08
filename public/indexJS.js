/* JavaScript functions for the Main Index Page */
var prevViewID = "";


//Functions that occur when the window is reloaded - Loading the periods and accomplishments list
window.onload = function(){
  $.ajax({
    type: "POST",
    url: "/getPeriods",
    cache: false,
    success: function(response){
      document.getElementById("periods").innerHTML = response;
    }
  });

  $.ajax({
    type: "POST",
    url: "/getAccomplishments",
    cache: false,
    success: function(response){
      document.getElementById("accompList").innerHTML = response;
    }
  });
}

/**
* Loads the leaderboard table, gets the top 5 performers
*/
var chartAnimation = true;
function loadLeaderboard(){
  setTimeout(function(){
    $.ajax({
      type: "POST",
      url: "/leaderboard",
      cache: false,
      success: function(response){

        CanvasJS.addColorSet("goldSilverBronze", [ "red","#014D65","#b87333","silver","gold"]);
        var chart = new CanvasJS.Chart("leaderboardTable", {
          width: 0,
          animationEnabled: chartAnimation,
          colorSet:"goldSilverBronze",
          title:{
            text:"Employees with the Highest Points",
            horizontalAlign: "center",
            verticalAlign: "top"
          },
          axisX:{
            ticks: {
              min: 0,
              stepSize: 1
            },
            interval: 1
          },
          axisY2:{
            ticks: {
              interval: 1,
              min: 0
            },
            gridColor: "rgba(1,77,101,.1)",
            title: "Number of Points"
          },
          data: [{
            type: "bar",
            name: "companies",
            axisYType: "secondary",
            dataPoints: [
              { y: response[4][0], label: response[4][1] },
              { y: response[3][0], label: response[3][1] },
              { y: response[2][0], label: response[2][1] },
              { y: response[1][0], label: response[1][1] },
              { y: response[0][0], label: response[0][1] },
            ]
          }]
          });
          document.getElementById("leaderboardTable").style.visibility = "visible";
          chart.render();
          chartAnimation = false;
        }
    });
  }, 500);
}

/* Submits form when enter is pressed */
document.querySelector("#add_points").addEventListener("keyup", event => {
  if(event.key !== "Enter") return;
  document.querySelector("#submitPoints").click();
  event.preventDefault();
});
document.querySelector("#view_points").addEventListener("keyup", event => {
  if(event.key !== "Enter") return;
  document.querySelector("#viewPointButton").click();
  event.preventDefault();
});
$('#core_id').keypress(function(e) {
  if(e.which == '13') {
    //Enter key just got pressed
    if($('#core_id').val()){
      var elem = document.getElementById("myBar");
      if(elem.style.width.substring(0,elem.style.width.length-1) == "0")
        typingTimer = setTimeout(findInformation, 0);
    }else{
      document.getElementById("valid").innerHTML = "Invalid ID";
      document.getElementById("valid").style.visibility = "hidden";
      document.getElementById("name").value = "";
      document.getElementById("manager").value = "";
    }
  }
});

//Checks when a user leaves a specified element
$('#core_id').focusout(function(){
  if($('#core_id').val()){
    var elem = document.getElementById("myBar");
    if(elem.style.width.substring(0,elem.style.width.length-1) == "0")
      findInformation();
  }else{
    document.getElementById("valid").innerHTML = "Invalid ID";
    document.getElementById("valid").style.visibility = "hidden";
    document.getElementById("name").value = "";
    document.getElementById("manager").value = "";
  }
});

$('#core_id').on('keyup', function() {
    // document.getElementById("core_id_view").value = $('#core_id').val();
    if(prevViewID == ""){
      document.getElementById("core_id_view").value = $('#core_id').val();
    }else{
      document.getElementById("core_id_view").value = prevViewID;
    }
    // if(prevViewID != "" && (document.getElementById("core_id_view").value != document.getElementById("coreID").value)){
    //
    // }
    //
});

$('#core_id_view').on('keyup', function() {
    document.getElementById("core_id").value = $('#core_id_view').val();
});

/**
*Function to find the manager and input the manager into the text box
*/
function findInformation(){
  //Loads the progress bar across the top of the screen
  var elem = document.getElementById("myBar");
  var width = 0;
  var id = setInterval(frame, 0);
  function frame() {
    if (width >= 100) {
      clearInterval(id);
      elem.style.width = "0%";
    } else {
      width++;
      elem.style.width = width + '%';
    }
  }
  //Performs the search
  var core_id = document.getElementById("core_id").value;
  $.ajax({
    type: "POST",
    url: "/findInformation",
    data: { "CORE_ID": core_id },
    cache: false,
    success: function(response){
      if(response[0] == "Invalid ID")
      {
        document.getElementById("valid").innerHTML = "Invalid ID";
        document.getElementById("valid").style.visibility = "visible";
        document.getElementById("name").value = "";
        document.getElementById("manager").value = "";
      }
      else{
        document.getElementById("valid").innerHTML = response[2];
        document.getElementById("valid").style.visibility = "visible";
        document.getElementById("name").value = response[0];
        document.getElementById("manager").value = response[1];
      }

    }
  });
}

/**
* On click action when the submit button is pressed in the view page
*/
function viewPoints(){
  //Temporarily disable the button so the user can't click it again
  chartAnimation = true;
  var btn = document.getElementById("viewPointButton");
  btn.disabled = true;
  var core_id = document.getElementById("core_id_view").value;
  var period = document.getElementById("periods").value;
  prevViewID = core_id;
  $.ajax({
    type: "POST",
    url: "/viewPoints",
    data: { "CORE_ID": core_id,
            "PERIOD": period
    },
    cache: false,
    success: function(response){
      if(response[0] == "invalid")
      {
        document.getElementById("userTable").innerHTML = "";
        document.getElementById("groupList").innerHTML = "";
        document.getElementById("employeeList").innerHTML = "";
        document.getElementById("userTable").style.visibility ="hidden";
        document.getElementById("btnCollapseOne").style.visibility ="hidden";
        document.getElementById("groupList").style.visibility ="hidden";
        document.getElementById("btnCollapseTwo").style.visibility ="hidden";
        document.getElementById("employeeList").style.visibility ="hidden";
        document.getElementById("btnCollapseThree").style.visibility ="hidden";
        document.getElementById("chartDisplayButton").style.visibility ="hidden";
        document.getElementById("pieChart").innerHTML = "";
        document.getElementById("pieChart").style.visibility ="hidden";
        document.getElementById("pieChart").style.height ="0px";
        document.getElementById("userInformation").innerHTML = "";
        setTimeout(alert("Please enter a valid Employee ID"),1000);
      }
      else{

        document.getElementById("collapseOne").style = "";
        document.getElementById("userInformation").innerHTML = response[5];

        $("#btnCollapseOne").attr("aria-expanded","true");
        $("#btnCollapseOne").removeClass("collapsed");
        $("#collapseOne").addClass("in");
        $("#collapseOne").attr("aria-expanded","true");

        $("#btnCollapseTwo").attr("aria-expanded","false");
        $("#btnCollapseTwo").addClass("collapsed");
        $("#collapseTwo").removeClass("in");
        $("#collapseTwo").attr("aria-expanded","false");

        $("#btnCollapseThree").attr("aria-expanded","false");
        $("#btnCollapseThree").addClass("collapsed");
        $("#collapseThree").removeClass("in");
        $("#collapseThree").attr("aria-expanded","false");

        if(response[0] != null){
          document.getElementById("userTable").innerHTML = response[0];
          document.getElementById("userTable").style.visibility ="visible";
          document.getElementById("btnCollapseOne").style.visibility ="visible";
        }
        else{
          document.getElementById("userTable").innerHTML = "";
          document.getElementById("userTable").style.visibility ="hidden";
          document.getElementById("btnCollapseOne").style.visibility ="hidden";
        }

        if(response[1] != null){
          document.getElementById("groupList").innerHTML = response[1];
          document.getElementById("groupList").style.visibility ="visible";
          document.getElementById("btnCollapseTwo").style.visibility ="visible";
        }
        else{
          document.getElementById("groupList").innerHTML = "";
          document.getElementById("groupList").style.visibility ="hidden";
          document.getElementById("btnCollapseTwo").style.visibility ="hidden";
        }

        if(response[2] != null){
          document.getElementById("employeeList").innerHTML = response[2];
          document.getElementById("employeeList").style.visibility ="visible";
          document.getElementById("btnCollapseThree").style.visibility ="visible";
        }
        else{
          document.getElementById("employeeList").innerHTML = "";
          document.getElementById("employeeList").style.visibility ="hidden";
          document.getElementById("btnCollapseThree").style.visibility ="hidden";
        }
        var total = null;
        var incomplete = null;
        if(response[3] != null && response[4] != null){
          var incomplete = {y: response[3], label: "Points Needed: "};
          var total = {y: response[4], label: "Completed Points: "};
          CanvasJS.addColorSet("redGreen", ["red", "green"]);
          var chart = new CanvasJS.Chart("pieChart", {
            animationEnabled: true,
            colorSet: "redGreen",
            title: {
              text: "Your Employees Progression"
            },
            data: [{
              type: "pie",
              startAngle: 240,
              yValueFormatString: "##0 Points",
              indexLabel: "{label} {y}",
              dataPoints: [
                incomplete,
                total
              ]
            }]
          });
          chart.render();
          document.getElementById("chartDisplayButton").style.visibility ="visible";
          document.getElementById("pieChart").style.visibility ="visible";
          document.getElementById("pieChart").style.height ="400px";
        }
        else{
          document.getElementById("chartDisplayButton").style.visibility ="hidden";
          document.getElementById("pieChart").innerHTML = "";
          document.getElementById("pieChart").style.visibility ="hidden";
          document.getElementById("pieChart").style.height ="0px";
        }
        btn.disabled = false;
      }
    }
  });
  return false;
}

/**
* Removes an achievement from an employee's list
* @param {Int} activityid The ID of the specified activity
* @param {Int} accompid The ID pf the accomplishment that is removed (For finding the points)
*/
function removeAcheivement(activityid, accompid){
  document.getElementById('deleteConfirm').onclick = function() {
    $.ajax({
      type: "POST",
      url: "/removeAcheivement",
      data: {
        "ACTIVITYID": activityid,
        "ACCOMPID": accompid
      },
      cache: false,
      success: function(response){
        if(response){
          document.getElementById('closeModal').click();
          viewPoints();
          // alert("Successfully Deleted");
        }
        else{
          alert("Error Deleting");
        }
      }
    });
  }
}

/**
* Adds points to an employee
*/
function addPoints(){
  chartAnimation = true;
  var core_id = document.getElementById("core_id").value;
  var accomplishment = document.getElementById("accomplishment").value;
  var description = document.getElementById("desc").value;
  var manager = document.getElementById("manager").value;
  if(core_id == ""){
    alert("Please enter a Core ID or Employee ID");
  }
  else if(manager == ""){
    alert("Please enter a valid Core ID or Employee ID")
  }
  else if(accomplishment == 1){
    alert("Please select an Accomplishment");
  }
  else if(description == ""){
    alert("Please enter a brief Description of your work");
  }
  else{
    $.ajax({
      type: "POST",
      url: "/addPoints",
      data: { "CORE_ID": core_id,
      "ACCOMPLISHMENT": accomplishment,
      "DESCRIPTION": description,
      "MANAGER": manager
     },
      cache: false,
      success: function(response){
        if(response == "Failure"){

          alert("Error sending Response");
        }
        else{
          document.getElementById("add_points_tab").classList.remove('active');
          document.getElementById("view_points_tab").classList.add('active');
          document.getElementById("add_points").classList.remove('active');
          document.getElementById("add_points").classList.remove('in');
          document.getElementById("view_points").classList.add('active');
          document.getElementById("view_points").classList.add('in');
          document.getElementById("core_id_view").value = core_id;
          document.getElementById("viewPointButton").click();
          document.getElementById("accomplishment").value = "1";
          document.getElementById("desc").value = "";
        }
      }
    });
  }

  return false;
}

/**
* Searches for an employee listed under 'My Group' or 'My Employees's
*/
function showMoreDetails(element){
  var id = element.id;
  document.getElementById("core_id_view").value = id;
  document.getElementById("viewPointButton").click();
}
