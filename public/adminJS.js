/* JavaScript functions for the Admin Page */

/**
* Display File name with jQuery
*/
jQuery("input#fileUpload").change(function () {
    $( "label#file_name" ).replaceWith( "<label id='file_name'>Current File Selected : " + jQuery(this).val().replace("C:\\fakepath\\", "") + "</label>" );
});

/**
* Load the accomplishments list when the page loads
*/
window.onload = function(){
  loadAccomps();
}

/**
* Status Message for uploading CSV
*/
$(document).ready(function() {
  $('#uploadForm').submit(function() {
    $("#status").empty().text("File is uploading...");
      $(this).ajaxSubmit({
        error: function(xhr) {
          status('Error: ' + xhr.status);
        },
        success: function(response) {
          $("#status").empty().text(response);
          if(response == "File Upload Successful"){
            $( "label#file_name" ).replaceWith("");
            alert("Successfully Uploaded");
            return true;
          }
          else if(response == "Hacker!"){
            alert("Hackers are mean people that try to break things dontcha think? :<");
            return true;
          }
          else{
            alert("Error Uploading File, Please Ensure The File Follows the Proper Formatting Guidelines");
            return true;
          }
        }
    });
  return false;
  });
});

/**
* Request to change admin password
*/
function changePass(){
  var currPass = document.getElementById("currPassword").value;
  var newPass = document.getElementById("newPassword").value;
  var repeatPass = document.getElementById("repeatPassword").value;

  $.ajax({
    type: "POST",
    url: "/updatePass",
    data: {
      "currPass": currPass,
      "newPass": newPass,
      "repeatPass": repeatPass
    },
    cache: false,
    success: function(response){
      if(response == "FailureCurrent"){
        alert("Current Password Incorrect");
        return true;
        //window.location.replace("/verifyLogin");
      }
      else if(response == "FailureRepeat"){
        alert("New Passwords did not match");
        return true;
        // window.location.replace("/verifyLogin");
      }
      else if(response == "length"){
        alert("Password Length not long enough");
        return true;
      }else if(response == "SameChange"){
        alert("You are trying to reset the password to the current password");
        return true;
      }
      else if(response == "log in"){
        alert("You are not authorized to do this you cheeky monkey ;)");
      }
      else{
        alert("Password Changed Successfully");
        document.getElementById("currPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("repeatPassword").value = "";
        return true;
        // window.location.replace("/verifyLogin");
      }
    }

  });
  return false;
}

/**
* Load the accomplishments table
*/
function loadAccomps(){
  $.ajax({
    type: "POST",
    url: "/deleteAccomplishmentsTable",
    cache:false,
    success: function(response){
      if(response == "hacker"){
        alert("You really should be logged in for this stuff ya know :/");
      }
      else{
        document.getElementById('AcomplishmentTable').innerHTML = response;
      }
    }
  });
}

/**
* Request to delete an accomplishment
*/
function deleteAccomplishment(id){
  document.getElementById('deleteConfirm').onclick = function() {
    $.ajax({
      type: "POST",
      url: "/deleteAccomplishments",
      data: {
        "ID": id
      },
      cache: false,
      success: function(response){
        if(response == "hacker"){
          alert("You're a bad seed >:(");
        }
        if(response){
          loadAccomps();
          document.getElementById('closeModal').click();
          alert("Successfully Deleted");
        }
        else{
          alert("Error Deleting");
        }
      }
    });
  }
}

/**
* Request to make a new accomplishment
*/
function insertAccomp(){
  var desc = document.getElementById('newDesc').value;
  var points = document.getElementById('newPoints').value;
  if(desc == ""){
    alert("Please enter a description");
  }
  else if(points == ""){
    alert("Please enter a point value");
  }
  else if(points < 1){
    alert("Please enter a point value greater than zero.");
  }
  else{
    $.ajax({
      type: "POST",
      url: "/addAccomplishments",
      data: {
        "DESCRIPTION": desc,
        "POINTS": points
      },
      cache: false,
      success: function(response){
        if(response == "hacker"){
          alert("Don't touch my code thanks! <3");
        }
        else if(response){
          loadAccomps();
          alert("Accomplishment Added Successfully");
        }
        else{
          alert("Error Adding Accomplishment");
        }
      }
    });
  }
}
