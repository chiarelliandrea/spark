// Initialisation: Global variables
var DOIregex = /\b(10\.[0-9]{4,}(?:\.[0-9]+)*\/(?:(?![\"&\'])\S)+)/gim;
var historyUnique;
var allCitations = []
var countCitations = 0;
var checkCitations = 0;

// STEP 1b: Get the citation information and display it
// Note that the entire code in this script is wrapped inside the onPageLoad function except for the Reload button and the search field.
function onPageLoad(event) {
  // When the DOIHistory page is loaded, we want to know what is the preset citation style
  chrome.storage.sync.get(null, function (userSettings) {
    settingsFromSync = userSettings;
    referencingStyle = settingsFromSync.citStyle;
  });

  // General purpose function - it simply cleans DOIs when they include text that shouldn't be in a DOI. This might be replaced with a different regular expression
  function cleanHorribleHTML(doi) {
    doi = doi.split(",")[0];
    doi = doi.split(";")[0];
    doi = doi.split("/html")[0];
    doi = doi.split("/full")[0];
    doi = doi.split("Corpus")[0];
    doi = doi.split("About")[0];
    doi = doi.split("Section")[0];

    // With some regular expressions, we end up with a full stop at the end of the DOI. This breaks the APIs so has to be removed
    if (doi.endsWith(".")) {
      doi = doi.slice(0, -1);
    }

    return doi;
  }

  // STEP 3: API call to get citation information
  function crossCiteCit(theDOIweFound) {
    query = "https://doi.org/" + theDOIweFound;

    // Crosscite requires a specific header, where the citation style is specified. This is grabbed above as part of the onPageLoad function.
    part1 = "Accept";
    citStyle = referencingStyle;
    part2 = "text/x-bibliography; style=" + citStyle;

    return $.ajax({
      type: "GET",
      url: query,
      beforeSend: function (xhr) {
        xhr.setRequestHeader(part1, part2);
      },
      success: function (result) {
        // If a citation is found, it is pushed into the allCitations array. The "24SEPARATOR601" text is just used to save the citation and DOI in the same line of an array. An object would be more elegant but this works well.
        allCitations.push(result + "24SEPARATOR601" + theDOIweFound)
        checkCitations = checkCitations + 1  
        //console.log('success', countCitations, checkCitations)

        // If we have checked all the DOIs we have in the history, then we are ready to sort them and inject them into the page. This is duplicated below because we don't know whether the last ajax call will be successful or unsuccessful.
        if (checkCitations == countCitations){

          // Remove the spinner from the page
          document.getElementById("sparkSpin").remove();

          // Deduplicating the allCitations array, to avoid showing the same DOI in the history multiple times. Not entirely sure why duplicates happen, but they do!
          const uniqueSet = new Set(allCitations);
          allCitations = [...uniqueSet];

          allCitations = allCitations.sort();
          for (i=0; i<allCitations.length; i++){
            $(".harvestedCitationContainer").append(function () {
              return (
                '<div class="card2citation">' +
                '<a href="https:\\doi.org\\' +
                encodeURIComponent(allCitations[i].split("24SEPARATOR601")[1]) + // Note: without encodeURIComponent the DOI may turn into HTML using %20 and other nasty stuff that can't always be passed onto doi.org without errors
                '" target = "_blank">' +
                allCitations[i].split("24SEPARATOR601")[0] +
                '</a>' +
                '</div>'
              );
            });
          }
        }

      },
      error: function (result) {
        checkCitations = checkCitations + 1
        //console.log('fail', countCitations, checkCitations)

        // If we have checked all the DOIs we have in the history, then we are ready to sort them and inject them into the page. This is duplicated above because we don't know whether the last ajax call will be successful or unsuccessful.
        if (checkCitations == countCitations){

          // Remove the spinner from the page
          document.getElementById("sparkSpin").remove();

          // Deduplicating the allCitations array, to avoid showing the same DOI in the history multiple times. Not entirely sure why duplicates happen, but they do!
          const uniqueSet = new Set(allCitations);
          allCitations = [...uniqueSet];

          allCitations = allCitations.sort();
          for (i=0; i<allCitations.length; i++){
            $(".harvestedCitationContainer").append(function () {
              return (
                '  <div class="card2citation">' +
                '<a href="https:\\doi.org\\' +
                encodeURIComponent(allCitations[i].split("24SEPARATOR601")[1]) +
                '" target = "_blank">' +
                allCitations[i].split("24SEPARATOR601")[0] +
                '</a>' +
                '</div>'
              );
            });
          }
       }
      },
    });
  }

  // STEP 2: Get all the DOIs saved in Chrome as the user is browsing
  chrome.storage.sync.get(function (cfg) {
    SparkDOIs = cfg.SparkHistory;

    if(typeof(SparkDOIs)==='undefined'){
      // Remove the spinner from the page
      document.getElementById("sparkSpin").remove();
      
      $(".harvestedCitationContainer").append(function () {
        return (
          '<div class="card2citation">' +
          '<a> Nothing to see here (yet!)... </a>' +
          '</div>'
        );
      });
    }

    // Make sure we have a unique list and aren't repeating any DOIs (this should already be the case given the below is in the contentScript too!)
    const uniqueSet = new Set(SparkDOIs);
    var historyUnique = [...uniqueSet];

    countCitations = historyUnique.length;

    // Make sure that we have only clean DOIs for the query - sometimes the regex in the contentScript might pick up 'dirty' strings that need a bit of cleaning
    for (i = 0; i < countCitations; i++) {
      historyUnique[i] = decodeURIComponent(historyUnique[i])
      historyUnique[i] = String(historyUnique[i].match(DOIregex));
      historyUnique[i] = cleanHorribleHTML(historyUnique[i]);
      historyUnique[i] = historyUnique[i].replace("%2F", "/");
    }

    // Inject a div to tell the user what is the current citation style (selected via the Options page)
    $(".introText").append(function () {
      return (
        '<div class="citationStyle">' +
        "Your citation style is " +
        referencingStyle +
        ".</div>"
      );
    });

    // Go through every DOI
    for (i = 0; i < historyUnique.length; i++) {
      // The 'if' below makes sure that the DOI is valid - it's a very basic check, just making sure that the DOI starts with a '10'. The contentScript may occasionally harvest DOIs incorrectly and we don't want to run queries with these
      if (historyUnique[i].slice(0, 2) === "10") {
        
        // Make the API call to get the citation for each DOI saved
        crossCiteCit(historyUnique[i])
          .then(function (data) {
            // This command below (it could be anything) is needed for the asynchronous call to work
            anythingYouWant = 1 + 1;
          })
          .catch(function (err) {});
      }
    }

  });

}

function copyEverything() {
  // We reset the filter to show all references
  var resetSearch = document.getElementById("SparkSearchBox");
  resetSearch.value = "";
  matcher = new RegExp("", "gi");
  $("#containerHistory")
    .children()
    .hide()
    .filter(function () {
      return matcher.test($(this).text());
    })
    .show();

  // We extract the elements where the references are saved
  itemsFromHTML = document.getElementsByClassName("card2citation");

  // itemsFromHTML is an 'HTMLCollection', but what we really want is an array. Hence:
  var itemsFromHTMLasAnArray = [].slice.call(itemsFromHTML);

  var contentOfTheTags = "";

  // And this array is a bit heavy and needs extracting the information we want:
  for (i = 0; i < itemsFromHTMLasAnArray.length; i++) {
    // The first row doesn't need the new line
    if (itemsFromHTMLasAnArray[i].innerText && i == 0) {
      contentOfTheTags = contentOfTheTags + itemsFromHTMLasAnArray[i].innerText;
    }
    // Any other rows are separated as new lines
    if (itemsFromHTMLasAnArray[i].innerText && i != 0) {
      contentOfTheTags =
        contentOfTheTags + "\n" + itemsFromHTMLasAnArray[i].innerText;
    }
  }

  // Copy and paste the list of citations (asynchronous function)
  navigator.clipboard.writeText(contentOfTheTags).then(
    () =>
      // This command below (it could be anything) is needed for the asynchronous copy and paste feature to work
      (anythingYouWant = 1 + 1)
  );

  var letsCopy = document.getElementById("copyButton");

  // When the citation button is clicked, an animation is displayed
  letsCopy.style.backgroundColor = "#b18597";
  letsCopy.textContent = "Copied!";
  letsCopy.style.color = "white";

  // We restore the button to its original state after 1500ms
  setTimeout(function () {
    letsCopy.textContent = "Copy all references";
  }, 1500);
}

// This is simply reloading the DOIHistory page when the user presses the button at the bottom of the page
function reloadHistory() {
  location.reload();
}

// STEP 1a: Event listener for when the DOIHistory page is loaded. It triggers the onPageLoad function at the top.
document.addEventListener("DOMContentLoaded", onPageLoad, true);

// Event listener for the reload button at the bottom of the page
document
  .getElementById("reloadHistory")
  .addEventListener("click", reloadHistory);

document.getElementById("copyButton").addEventListener("click", copyEverything);

// Search functionality to filter one's DOI history
$("#SparkSearchBox").on("keyup", function () {
  var matcher = new RegExp($(this).val(), "gi");
  $("#containerHistory")
    .children()
    .hide()
    .filter(function () {
      return matcher.test($(this).text());
    })
    .show();
});
