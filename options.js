// Function to save the options set by the user
function save_options() {
  var userEmail = document.getElementById("emailForUnpaywall").value;
  var APIKeyforCORE = document.getElementById("coreAPIkey").value;
  var UnpaywallAPIOnOff = document.getElementById(
    "UnpaywallAPICheckbox"
  ).checked;
  var COREAPIOnOff = document.getElementById("COREAPICheckbox").checked;
  var citStyle = document.getElementById("dataListSelection").value;

  chrome.storage.sync.set(
    {
      userEmail: userEmail,
      APIKeyforCORE: APIKeyforCORE,
      UnpaywallAPIOnOff: UnpaywallAPIOnOff,
      COREAPIOnOff: COREAPIOnOff,
      citStyle: citStyle,
      firstLaunch: "All done",
    },
    function () {
      // When the citation button is clicked, an animation is displayed
      var status = document.getElementById("save");
      status.style.backgroundColor = "#b18597";
      status.textContent = "Thanks, all done!";
      status.style.color = "white";

      // We restore the button to its original state after 1500ms
      setTimeout(function () {
        status.attributeStyleMap.clear();
        status.textContent = "Save your settings";
        status.classList.add("buttonAction");
        status.classList.add("learn-more-Spark");
      }, 1500);
    }
  );
}

// Restores select box and checkbox state using the preferences stored in the Chrome storage
function restore_options() {
  // Use default values
  chrome.storage.sync.get(
    {
      userEmail: "scholarlyspark@tuta.io",
      APIKeyforCORE: "Please enter your API key",
      UnpaywallAPIOnOff: true,
      COREAPIOnOff: false,
      citStyle: "apa",
    },
    function (items) {
      document.getElementById("emailForUnpaywall").value = items.userEmail;
      document.getElementById("coreAPIkey").value = items.APIKeyforCORE;
      document.getElementById("UnpaywallAPICheckbox").checked =
        items.UnpaywallAPIOnOff;
      document.getElementById("COREAPICheckbox").checked = items.COREAPIOnOff;
      document.getElementById("dataListSelection").value = items.citStyle;
    }
  );
}

// Event listener for when the Options page is loaded. It triggers the restore_options function at the top.
document.addEventListener("DOMContentLoaded", restore_options);

// Event listener for the save button at the bottom of the page
document.getElementById("save").addEventListener("click", save_options);
