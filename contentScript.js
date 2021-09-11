// Initialisation: Global variables
var badgeLinkIsInserted = false;
var badgeCitationIsInserted = false;
var badgeOpenCitIsInserted = false;
var RUNUnpaywall = true;
var myHost;
var pageURL;
var grabPageHTML;
var theDOIweAreLookingFor;
var doi;
var contentOfTheMetaTags = [];
var DOIregex = /\b(10\.[0-9]{4,}(?:\.[0-9]+)*\/(?:(?![\"&\'])\S)+)/gim;
var TagsfromHTML;
var currentPage = location.href;

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

// STEP 2: Get the page URL and host
function letsBegin() {
  whereAreWe = window.location;
  pageURL = whereAreWe.href;
  myHost = whereAreWe.host;
  initialiseSettings();
}

// STEP 4: We're ready to launch the code. Settings are loaded from the Chrome storage and things are set into motion
function readyToGo() {
  chrome.storage.sync.get(null, function (userSettings) {
    emailConfig = userSettings.userEmail;
    COREQueryKey = userSettings.APIKeyforCORE;
    RUNUnpaywall = userSettings.UnpaywallAPIOnOff;
    RUNCORE = userSettings.COREAPIOnOff;
    referencingStyle = userSettings.citStyle;
  });

  // The code is delayed to ensure that all elements of the page are loaded
  delayCheckingThePage();
}

// STEP 3: Initialises settings at the time of installation or launch the code directly
function initialiseSettings() {
  chrome.storage.sync.get(null, function (userSettings) {
    if (userSettings.firstLaunch === undefined) {
      chrome.storage.sync.set({
        userEmail: "scholarlyspark@tuta.io",
        APIKeyforCORE: "Please enter your API key",
        UnpaywallAPIOnOff: true,
        COREAPIOnOff: false,
        citStyle: "apa",
        firstLaunch: "All done",
      });

      // Launch the code if this was the first launch of the extension
      readyToGo();
    } else {
      // Launch the code after the first launch of the extension
      readyToGo();
    }
  });
}

// STEP 8d
function coreAPIstart(theDOIweFound) {
  if (COREQueryKey == "Please enter your API key") {
    insertBadge("No CORE API key or CORE/Unpaywall query failed.", "link");
  } else {
    // Send the API call to the background.js script
    chrome.runtime.sendMessage(
      {
        contentScriptQuery: "requestCORE",
        doi: theDOIweFound,
        APIKey: COREQueryKey,
      },
      (response) => {
        // If we have a response from the API, we insert a button to allow one-click access.
        // Interestingly sometimes we get a successful status but empty result, so the conditions below acknowledge that - e.g. on this page: https://doi.org/10.1016/j.ijrefrig.2004.08.005
        if (response.APIstatus == "success" && response.APIresult != "") {
          insertBadge(response.APIresult, "link");
        }
        if (response.APIstatus == "fail" || response.APIresult == "") {
          // A greyed out badge is interted if the API call was unsuccessful
          insertBadge(
            "No CORE API key or CORE/Unpaywall query failed.",
            "link"
          );
        }
      }
    );
  }
}

// STEP 8c
function unpaywallAPIstart(theDOIweFound) {
  // Send the API call to the background.js script
  chrome.runtime.sendMessage(
    {
      contentScriptQuery: "requestUnpaywall",
      doi: theDOIweFound,
      courtesyEmail: emailConfig,
    },
    (response) => {
      // If we have a response from the API, we insert a button to allow one-click access.
      if (response.APIstatus == "success") {
        insertBadge(response.APIresult, "link");
      }
      if (response.APIstatus == "fail") {
        if (RUNCORE === true) {
          // Make the CORE.ac.uk API call
          coreAPIstart(theDOIweFound);
        }
      }
      if (RUNCORE === false) {
        // A greyed out badge is interted if the API call was unsuccessful
        insertBadge("No CORE API key or CORE/Unpaywall query failed.", "link");
      }
    }
  );
}

// STEP 8b: API call to get DOIs cited by the DOI that we have identified
function OpenCitationsAPIstart(theDOIweFound) {
  // Send the API call to the background.js script
  chrome.runtime.sendMessage(
    { contentScriptQuery: "requestOpenCitations", doi: theDOIweFound },
    (response) => {
      // If we have a response from the API, we insert a button to view the DOIs cited. These are turned into proper citations, which are clickable and include a link.
      if (response.APIstatus == "success") {
        title = "openCit";

        // Create a modal to shade the page
        OCmodalSpark = document.createElement("div");
        OCmodalSpark.style.zIndex = "24601";
        OCmodalSpark.id = title;
        document.documentElement.appendChild(OCmodalSpark);
        OCmodalSparkID = document.getElementById(title);
        OCmodalSparkID.classList.add("modalSpark");

        // Create the div to host the citation information
        OCmodalContentSpark = document.createElement("div");
        OCmodalContentSpark.id = title + "modalContentSpark";
        OCmodalSparkID.appendChild(OCmodalContentSpark);
        OCmodalContentSparkID = document.getElementById(
          title + "modalContentSpark"
        );
        OCmodalContentSparkID.classList.add("modalSpark-content");

        // Create the 'X' in the top right corner to close the modal
        OCmodalSpanSpark = document.createElement("span");
        OCmodalSpanSpark.id = title + "modalSpanSpark";
        OCmodalSpanSpark.textContent = "x";
        OCmodalContentSparkID.appendChild(OCmodalSpanSpark);
        OCmodalSpanSparkID = document.getElementById(title + "modalSpanSpark");
        OCmodalSpanSparkID.classList.add("closeSpark");

        // When the user clicks on the 'X' span, we close the modal
        OCmodalSpanSpark.onclick = function () {
          OCmodalSparkID.style.display = "none";
        };

        // From the Open Citations API we typically receive an array of DOIs cited by the DOI we found.
        // We need to loop through these to add them to the list in the modal
        OCAPIresult = response.APIresult;

        for (i = 0; i < OCAPIresult.length; i++) {
          crossCiteCit(OCAPIresult[i], "citation for modal")
            .then(function (citationFound) {
              // This command below (it could be anything) is needed for the asynchronous call to work
              anythingYouWant = 1 + 1;
            })
            .catch(function (err) {});
        }

        // A badge is interted to view the cited DOIs and browse them, if any have been found
        insertBadge(response.APIresult, "OpenCitations");
      }
      // A greyed out badge is interted if the API call was unsuccessful
      if (response.APIstatus == "fail") {
        // Create the unsuccessful button ('dead') and inject it into the page
        var deadOpenCit = document.createElement("button");
        deadOpenCit.style.zIndex = "24600";
        deadOpenCit.style.position = "fixed";
        deadOpenCit.style.bottom = "10px";
        deadOpenCit.style.left = "180px";
        deadOpenCit.style.margin = "0px";
        deadOpenCit.style.width = "80px";
        deadOpenCit.style.padding = "5px 7px";
        deadOpenCit.id = "deadSparkOpenCite";
        deadOpenCit.textContent = "Explore";
        document.documentElement.appendChild(deadOpenCit);
        badgeOpenCitIsInserted = true;
        var deadOpenCitID = document.getElementById("deadSparkOpenCite");
        deadOpenCitID.classList.add("buttonActionDead");
      }
    }
  );
}

// STEP 8a: API call to get citation information
function crossCiteCit(theDOIweFound, requestType) {
  query = "https://doi.org/" + theDOIweFound;
  //console.log(theDOIweFound)
  
  // Crosscite requires a specific header, where the citation style is specified. This is grabbed as part of STEP 4
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
      if (requestType === "citation for modal") { // This part of the response is only executed to populate the modal for the "Explore button"
        // Inject the cited DOI into the modal
        $(".modalSpark-content").append(function () {
          // Note: without encodeURIComponent the DOI may turn into HTML using %20 and other nasty stuff that can't always be passed onto doi.org without errors
          return (
            '<p class="OpenCitPar">' +
            '<a href="https://doi.org/' +
            encodeURIComponent(theDOIweFound) +
            '" target = "_blank" class="OpenCitlink">' +
            result +
            "</a></p>"
          );
        });
      }
    },
    error: function (result) {},
  });
}

// STEP 8: It's time to make the API calls
function runAPIcalls(theDOIweFound) {
  // In all cases, we look for citation information. This is the only API call made within the present script
  if (theDOIweFound != null) {
    crossCiteCit(theDOIweFound, "normal citation")
      .then(function (citationFound) {
        // A badge is interted to copy and paste the citation, if one is found
        insertBadge(citationFound, "citation");
      })
      .catch(function (err) {});
  }

  // After looking for a citation, we populate the "Explore funcion, which is based on the Open Citations API"
  if (theDOIweFound != null) {
    OpenCitationsAPIstart(theDOIweFound);
  }

  // And finally we look for a one-click pdf version to serve to the user. This can use:
  // A) Unpaywall only, meaning that if Unpaywall is unsuccessful then no other source is checked
  // B) Unpaywall and CORE.ac.uk, meaning that if Unpaywall is unsuccessful then CORE.ac.uk is checked
  // C) CORE.ac.uk only, meaning that if CORE.ac.uk is unsuccessful then no other source is checked
  // Note that to enable CORE.ac.uk users need to enter an API key in the options menu. Unpaywall is enabled by default.
  if (theDOIweFound != null && RUNUnpaywall == true) {
    // Make the Unpaywall API call
    unpaywallAPIstart(theDOIweFound);
  }
  if (theDOIweFound != null && RUNUnpaywall == false && RUNCORE == true) {
    // Make the CORE.ac.uk API call
    coreAPIstart(theDOIweFound);
  }
}

// STEP 7a: The "Inspector" looks for meta tags and tried to find a DOI saved in them.
// Publishers doing this are helpful - structured information is always welcome.
function callTheInspector() {
  // We begin by parsing the HTML
  var parser = new DOMParser();
  var doc = parser.parseFromString(grabPageHTML, "text/html");

  // We extract meta tags
  TagsfromHTML = doc.getElementsByTagName("meta");

  // If there are no meta tags, tough luck
  if (!TagsfromHTML) {
    return null;
  }

  // TagsfromHTML is an 'HTMLCollection', but what we really want is an array. Hence:
  var TagsfromHTMLasAnArray = [].slice.call(TagsfromHTML);

  // And this array is a bit heavy and needs extracting the information we want:
  for (i = 0; i < TagsfromHTMLasAnArray.length; i++) {
    if (TagsfromHTMLasAnArray[i].content) {
      contentOfTheMetaTags[i] = TagsfromHTMLasAnArray[i].content;
    } else {
      contentOfTheMetaTags[i] = null;
    }
  }

  // Exception: Psycnet has some annoying HTML that we need to clean up to find the DOI. This was added by trial and error.
  if (pageURL.indexOf("psycnet") > -1) {
    for (i = 0; i < contentOfTheMetaTags.length; i++) {
      if (contentOfTheMetaTags[i] != null) {
        contentOfTheMetaTags[i] = contentOfTheMetaTags[i].replace(
          "/doiLanding?doi=",
          ""
        );
        contentOfTheMetaTags[i] = contentOfTheMetaTags[i].replace("%2F", "/");
      }
    }
  }

  // Finally: it's time to check the meta tags for a DOI
  found = contentOfTheMetaTags.find((value) => DOIregex.test(value));

  if (found) {
    // The DOI we found may or may not be clean. To make sure, we throw it in the DOIwasher
    foundClean = found.replace("doi: ", "");
    foundClean = foundClean.replace("doi:", "");
    foundClean = String(foundClean.match(DOIregex));
    foundClean = cleanHorribleHTML(foundClean);

    // Now we can finally return the nice and clean DOI to make the API calls
    if (foundClean) {
      theDOIweAreLookingFor = foundClean;
      return theDOIweAreLookingFor;
    } else {
      return null;
    }
  } else {
    return null;
  }
}

// STEP 7: This is Option 2 noted under Step 6. We start looking at the page's meta tags
function checkMetaTags() {
  // This calls the Inspector (a made up name!), which actually does the meta tag searching
  var theDOIweAreLookingFor = callTheInspector();

  // Did we find a DOI?
  if (theDOIweAreLookingFor) {
    // If we found a DOI, we start making API calls; otherwise, we have been defeated
    runAPIcalls(theDOIweAreLookingFor);

    return theDOIweAreLookingFor;
  } else {
    return;
  }
}

// STEP 6: Initiate the DOI search. The first thing to do is to pick a search pathway. Two options are available:
// Option 1: a bit rough - you just turn the page HTML into text and look for a DOI pattern
// Option 2: more sophisticated - looks at the meta tags in the page HTML to extract DOIs
// What is the difference between these two options? Simply that some publishers don't use structured tags so Option 2 is not viable in these cases.
// The list of publishers that are checked via Option 1 is available in the "if" statement below
function pickaSearchPathway() {
  grabPageHTML = document.documentElement.innerHTML;

  // This is Option 1. List of websites noted below.
  if (
    pageURL.indexOf("oxford.universitypressscholarship") > -1 ||
    pageURL.indexOf("sagepub.com") > -1 ||
    pageURL.indexOf("ahajournals.org") > -1 ||
    pageURL.indexOf("insights.uksg.org") > -1 ||
    pageURL.indexOf("tandfonline.com") > -1 ||
    pageURL.indexOf("academic.oup.com") > -1 ||
    pageURL.indexOf("repec") > -1 ||
    pageURL.indexOf("ieee") > -1 ||
    pageURL.indexOf("cairn") > -1 ||
    pageURL.indexOf("inderscienceonline") > -1 ||
    pageURL.indexOf("icevirtuallibrary") > -1 ||
    pageURL.indexOf("ascelibrary") > -1 ||
    pageURL.indexOf("sciencemag.org") > -1 || 
    pageURL.indexOf("semanticscholar.org/paper") > -1 ||
    pageURL.indexOf("onlinelibrary.wiley.com") > -1 || 
    pageURL.indexOf("journals.aom.org") > -1 ||
    pageURL.indexOf("science.org") > -1 ||
    pageURL.indexOf("mjlis.um.edu.my") > -1 ||
    pageURL.indexOf("codata.org") > -1 ||
    pageURL.indexOf("royalsocietypublishing.org") > -1 
    ) {
    // This converts the really ugly HTML into text we can scrape using a regular expression for DOIs
    convertedHTML = $("<textarea />").html(grabPageHTML).text();
    found = convertedHTML.match(DOIregex);

    // Check if the above matching has returned any DOI.
    if (found) {

      if (found.length==1){
      theDOIweAreLookingFor = String(found);
      }

      if (found.length>1){
        theDOIweAreLookingFor = String(found[0]);
      }

      // If we have found a DOI, this might need some cleaning. The function below has been developed by trial and error by checking incorrect or poor DOI matches
      theDOIweAreLookingFor = cleanHorribleHTML(theDOIweAreLookingFor);

      // The clean DOI is sent to the various API calls. Note that most of the API calls are in the script background.js due to some Chrome security policies
      runAPIcalls(theDOIweAreLookingFor);
    } else {
      return;
    }
  } else {
    // This means if we are NOT on one of the above websites that need a custom approach

    // Some pages won't be searched by default,because they are search engines. This list could be made infinitely longer...
    if (
      pageURL.indexOf("core.ac.uk/search") > -1 ||
      pageURL.indexOf("scholar.google.com/scholar") > -1 ||
      pageURL.indexOf("google.com/search") > -1 ||
      pageURL.indexOf("bing.com/search") > -1 ||
      pageURL.indexOf("duckduckgo.com/?q") > -1 ||
      pageURL.indexOf("europepmc.org/search") > -1 ||
      pageURL.indexOf("pubmed.ncbi.nlm.nih.gov/?term") > -1 ||
      pageURL.indexOf("semanticscholar.org/search") > -1 
    ) {
      // Do nothing
    } else {
      // This is Option 2, i.e. the preferred option - we start checking the HTML meta tags
      theDOIweAreLookingFor = checkMetaTags();
    }
  }

  // If no DOI is found, nothing happens
  if (!theDOIweAreLookingFor) {
    return;
  }

  // If a DOI is found, this is added to Spark's history
  if (theDOIweAreLookingFor) {
    // Cleaning the DOI just in case
    theDOIweAreLookingFor = cleanHorribleHTML(theDOIweAreLookingFor);

    chrome.storage.sync.get(function (cfg) {
      // If there is a history to begin with, we want to add to it
      if (
        typeof cfg["SparkHistory"] !== "undefined" &&
        cfg["SparkHistory"] instanceof Array
      ) {
        SparkDOIs = cfg.SparkHistory;

        // Add the new DOI to the SparkDOIs array
        SparkDOIs.push(theDOIweAreLookingFor);

        // Deduplicating the SparkDOIs array, to avoid logging the same DOI in the history multiple times
        const uniqueSet = new Set(SparkDOIs);
        var historyUnique = [...uniqueSet];

        // We replace the previous SparkDOIs array with a clean, deduplicated one
        cfg["SparkHistory"] = historyUnique;
      } else {
        // If there is no history to begin with, we make one
        cfg["SparkHistory"] = [theDOIweAreLookingFor];
      }

      // Pushing the changes into Spark's history, i.e. Chrome's storage
      chrome.storage.sync.set(cfg);
    });
  }
}

// STEP 5: The code is delayed to ensure that all elements of the page are loaded
function delayCheckingThePage() {
  delay = 2000;
  setTimeout(pickaSearchPathway, delay);
}

// STEP 1: The entire code is launched when this script is loaded
letsBegin();

// STEP 9: This is a long function that inserts badges for the user to click.
// Importantly, the badges are injected via Javascript, and their css is in the buttonStyle.css file.
// This css file needs to be loaded programmatically via the manifest.json.
// In contrast, e.g. the options.html file can load its own css directly in the HTML, while the present script is not attached to any HTML page and so needs the css loading in a different way
function insertBadge(badgeToInsert, type) {
  // Create badge for the one-click access
  if (type === "link" && badgeLinkIsInserted === false) {
    if (badgeToInsert == "No CORE API key or CORE/Unpaywall query failed.") {
      // Create the unsuccessful button ('dead') and inject it into the page
      var deadOAVersion = document.createElement("button");
      deadOAVersion.style.zIndex = "24600";
      deadOAVersion.style.position = "fixed";
      deadOAVersion.style.bottom = "10px";
      deadOAVersion.style.left = "95px";
      deadOAVersion.style.margin = "0px";
      deadOAVersion.style.width = "80px";
      deadOAVersion.style.padding = "5px 7px";
      deadOAVersion.id = "deadSparkLink";
      deadOAVersion.textContent = "Read";
      document.documentElement.appendChild(deadOAVersion);
      badgeLinkIsInserted = true;
      var deadOAVersionID = document.getElementById("deadSparkLink");
      deadOAVersionID.classList.add("buttonActionDead");
    } else {
      var buttonOAVersion = document.createElement("button");

      buttonOAVersion.style.zIndex = "24600";
      buttonOAVersion.style.position = "fixed";
      buttonOAVersion.style.bottom = "10px";
      buttonOAVersion.style.left = "95px";
      buttonOAVersion.style.width = "80px";
      buttonOAVersion.style.margin = "0px";
      buttonOAVersion.style.padding = "5px 7px";
      buttonOAVersion.id = "SparkLink";
      buttonOAVersion.textContent = "Read";

      document.documentElement.appendChild(buttonOAVersion);

      badgeLinkIsInserted = true;

      var buttonOAVersionID = document.getElementById("SparkLink");
      buttonOAVersionID.classList.add("learn-more-Spark");
      buttonOAVersionID.classList.add("buttonAction");

      // When the user clicks on the button, open the OA version found
      buttonOAVersionID.onclick = function () {
        window.open(badgeToInsert, "_blank");
      };
    }
  }

  // Create badge for the Open Citations modal
  if (type === "OpenCitations" && badgeOpenCitIsInserted === false) {
    var buttonOpenCit = document.createElement("button");

    buttonOpenCit.style.zIndex = "24600";
    buttonOpenCit.style.position = "fixed";
    buttonOpenCit.style.bottom = "10px";
    buttonOpenCit.style.left = "180px";
    buttonOpenCit.style.margin = "0px";
    buttonOpenCit.style.width = "80px";
    buttonOpenCit.style.padding = "5px 7px";
    buttonOpenCit.id = "SparkOpenCite";
    buttonOpenCit.textContent = "Explore";

    document.documentElement.appendChild(buttonOpenCit);

    badgeOpenCitIsInserted = true;

    OCmodalSparkID = document.getElementById("openCit");

    var buttonOpenCitID = document.getElementById("SparkOpenCite");
    buttonOpenCitID.classList.add("learn-more-Spark");
    buttonOpenCitID.classList.add("buttonAction");

    buttonOpenCit.onclick = function () {
      OCmodalSparkID.style.display = "block";
    };
  }

  // Create badge for the citation copy and paste feature
  if (type === "citation" && badgeCitationIsInserted === false) {
    var buttonSpark = document.createElement("button");
    buttonSpark.id = "SparkCite";
    buttonSpark.style.zIndex = "24600";
    buttonSpark.style.position = "fixed";
    buttonSpark.style.bottom = "10px";
    buttonSpark.style.left = "10px";
    buttonSpark.style.margin = "0px";
    buttonSpark.style.width = "80px";
    buttonSpark.style.padding = "5px 7px";

    buttonSpark.textContent = "Cite";
    document.documentElement.appendChild(buttonSpark);

    var buttonSparkID = document.getElementById("SparkCite");
    buttonSparkID.classList.add("learn-more-Spark");
    buttonSparkID.classList.add("buttonAction");

    title = "Citation";

    // When the citation button is clicked, the citation is copied to the clipboard
    buttonSparkID.onclick = function () {
      // Copy and paste the citation (asynchronous function)
      navigator.clipboard.writeText(badgeToInsert).then(
        () =>
          // This command below (it could be anything) is needed for the asynchronous copy and paste feature to work
          (anythingYouWant = 1 + 1)
      );

      // When the citation button is clicked, an animation is displayed
      buttonSparkID.style.backgroundColor = "#b18597";
      buttonSparkID.textContent = "Copied!";
      buttonSparkID.style.color = "white";

      // We restore the button to its original state after 1500ms
      setTimeout(function () {
        buttonSparkID.attributeStyleMap.clear();
        buttonSparkID.style.zIndex = "24600";
        buttonSparkID.style.position = "fixed";
        buttonSparkID.style.bottom = "10px";
        buttonSparkID.style.left = "10px";
        buttonSparkID.style.margin = "0px";
        buttonSparkID.style.width = "80px";
        buttonSparkID.style.padding = "5px 7px";
        buttonSparkID.textContent = "Cite";
        buttonSparkID.classList.add("learn-more-Spark");
        buttonSparkID.classList.add("buttonAction");
      }, 1500);
    };

    badgeCitationIsInserted = true;
  }
}

// This final bit is for URL change detection. It is useful mainly for Europe PMC because the page does not do a full refresh.
// We listen for changes in the page location ever 500 milliseconds and re-launch the code if the url has changed without a full refresh.
setInterval(function () {
  if (currentPage != location.href) {
    // If the URL has changed, we delete all badges/modals/items created by the extension.
    // Note that this happens by default when the page is refreshed/reloaded. This code is only needed for pages that don't do a full refresh.
    currentPage = location.href;

    if (document.getElementById("SparkCite")) {
      var frame1 = document.getElementById("SparkCite");
      frame1.parentNode.removeChild(frame1);
    }

    if (document.getElementById("SparkLink")) {
      var frame2 = document.getElementById("SparkLink");
      frame2.parentNode.removeChild(frame2);
    }

    if (document.getElementById("openCit")) {
      var frame3 = document.getElementById("openCit");
      frame3.parentNode.removeChild(frame3);
    }

    if (document.getElementById("SparkOpenCite")) {
      var frame4 = document.getElementById("SparkOpenCite");
      frame4.parentNode.removeChild(frame4);
    }

    if (document.getElementById("Citation")) {
      var frame5 = document.getElementById("Citation");
      frame5.parentNode.removeChild(frame5);
    }

    if (document.getElementById("deadSparkOpenCite")) {
      var frame6 = document.getElementById("deadSparkOpenCite");
      frame6.parentNode.removeChild(frame6);
    }

    if (document.getElementById("deadSparkLink")) {
      var frame7 = document.getElementById("deadSparkLink");
      frame7.parentNode.removeChild(frame7);
    }

    badgeLinkIsInserted = false;
    badgeCitationIsInserted = false;
    badgeOpenCitIsInserted = false;

    grabPageHTML = null;

    // Restart the code from the begininng
    letsBegin();
  }
}, 500);
