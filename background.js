// The below is a listener: it waits for a call from the content script (contentScript.js).
// If there is no call, this script is dormant.

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // This listener is built to suit all three APIs in the content script: Open Citations, Unpaywall and CORE.ac.uk
  // The query for the API call is built based on the message received via 'contentScriptQuery below
  // Note that each API has different requirements (e.g. API key for CORE.ac.uk, email for Unpaywall): these are sent by the content script and part of the 'request' variable

  // Open Citations query
  if (request.contentScriptQuery == "requestOpenCitations") {
    var OpenCitationsQuery =
      "https://opencitations.net/index/api/v1/references/";
    query = OpenCitationsQuery.concat(request.doi);
  }

  // Unpaywall query
  if (request.contentScriptQuery == "requestUnpaywall") {
    var UnpaywallQuery = "https://api.oadoi.org/v2/";
    var UnpaywallEnding = "?email=" + request.courtesyEmail;
    query = UnpaywallQuery.concat(request.doi);
    query = query.concat(UnpaywallEnding);
  }

  // CORE.ac.uk query
  if (request.contentScriptQuery == "requestCORE") {
    var COREQuery = "https://api.core.ac.uk/v3/search/works?q=doi%3A%22";
    var COREQueryEnding = "%22&limit=10&api_key=";
    query = COREQuery.concat(request.doi);
    query = query.concat(COREQueryEnding);
    query = query.concat(request.APIKey);
  }

  // The 'fetch' command runs the API call
  fetch(query)
    .then(function (response) {
      if (response.status !== 200) {
        console.log(
          "Looks like there was a problem. Status Code: " + response.status
        );
      }

      // Examine the text in the API response
      response.json().then(function (data) {
        // If the results come from Open Citations:
        if (request.contentScriptQuery == "requestOpenCitations") {
          if (data.length > 0) {
            var externalCitations = [];
            for (i = 0; i < data.length; i++) {
              externalCitations[i] = data[i].cited;

              // The response includes some text that we don't need so we get rid of it
              externalCitations[i] = externalCitations[i].replace(
                "coci => ",
                ""
              );
            }

            sendResponse({
              APIstatus: "success",
              APIresult: externalCitations,
            });
          } else {
            sendResponse({
              APIstatus: "fail",
            });
          }
        }

        // If the results come from Unpaywall:
        if (request.contentScriptQuery == "requestUnpaywall") {
          if (data.best_oa_location != null) {
            sendResponse({
              APIstatus: "success",
              APIresult: data.best_oa_location.url,
            });
          } else {
            sendResponse({
              APIstatus: "fail",
            });
          }
        }

        // If the results come from CORE:
        if (request.contentScriptQuery == "requestCORE") {
          if (data.totalHits != 0) {
            sendResponse({
              APIstatus: "success",
              APIresult: data.results[0].downloadUrl,
            });
          } else {
            sendResponse({
              APIstatus: "fail",
            });
          }
        }
      });
    })
    .catch(function (err) {
      console.log("Fetch Error :-S", err);

      sendResponse({
        APIstatus: "fail",
      });
    });

  // Inform Chrome that we will make a delayed sendResponse
  return true;
});
