jQuery("input#fileUpload").change(function () {
    $( "label#file_name" ).replaceWith( "<label id='file_name'>Current File Selected : " + jQuery(this).val().replace("C:\\fakepath\\", "") + "</label>" );
});

window.onload = function(){
  loadAccomps();
}

//Status Message for uploading CSV
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
            alert("Successfully Uploaded");
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

//Disable current tables and create new ones
function resetPeriod(){
  var name = document.getElementById("period_name").value;
  if(name == ""){
    alert("Please enter a name");
  }
  else{
    $.ajax({
      type: "POST",
      url: "/resetTables",
      data: { "periodName": name },
      cache: false,
      success: function(response){
        if(response == "Failure"){
          alert("Error Occurred");
          return true;
        }
        else{
          alert("Successfully Executed");
          return true;
        }
      }
    });
  }
return false;
}
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

function loadAccomps(){
  $.ajax({
    type: "POST",
    url: "/deleteAccomplishmentsTable",
    cache:false,
    success: function(response){
      document.getElementById('AcomplishmentTable').innerHTML = response;
    }
  });
}

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
        if(response){
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
