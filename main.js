chrome.tabs.onUpdated.addListener(function
    (tabId, changeInfo, tab) {
        // chrome.runtime.reload();
        // read changeInfo data and do something with it (like read the url)
      if (changeInfo.url) {
        
      }
    }
  );

function isObjectEmpty(object) {
  return JSON.stringify(object) === "{}";
}

function extractRoot(url) {
  return url.substr(url.indexOf("/") + 2).split('/')[0];
}

async function checkUrl (url) {
  const response = await fetch("http://localhost:3000/check-url", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({"url": extractRoot(url)})
    }).catch(err => {
      console.log(err);
    });

    // When the server doesn't respond //
    if(response === undefined) {
      throw new Error('Check-url request error.');
    }

    if(await response.status === 204) {
      // The url doesn't exist, we call the safe browsing API //
      requestSafeBrowsingAPI(url);
      return null;
    }

    // The url exist, we return a json object, containing the fields 'url' and 'isSafe' //
    // Status should be 200 //
    return await response.json();
}

function addUrl(url, isSafe, threatType) {
  fetch("http://localhost:3000/add-url", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({url: extractRoot(arguments[0]), isSafe: arguments[1], threatType: arguments[2]}),
  }).catch(err => {
    console.log(err);
  });
}

function requestSafeBrowsingAPI(url) {
  var requestBody = {
    "client": {
      "clientId": "yourcompanyname",
      "clientVersion": "1.5.2"
    },
    "threatInfo": {
      "threatTypes":      ["MALWARE", "SOCIAL_ENGINEERING", "POTENTIALLY_HARMFUL_APPLICATION", "UNWANTED_SOFTWARE", "THREAT_TYPE_UNSPECIFIED"],
      "platformTypes":    ["WINDOWS"],
      "threatEntryTypes": ["URL"],
      "threatEntries": [
        {"url": url}
      ]
    }
  }

  fetch(chrome.runtime.getURL('/credentials.json'))
  .then((resp) => resp.json())
  .then(function (credentials) {

    fetch("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + credentials[0]["webBrowsingAPI-key"], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
  }).then(function(response) {
    console.log("API Reponse Status: " + response.status); // Will show the status
    if (!response.ok) {
        throw new Error("HTTP Status " + response.status);
    }
    return response.json();
})
  .then(data => {
    if(isObjectEmpty(data)) {
      // Url is Safe //
      addUrl(url, true, null);

      messagePopup({url: extractRoot(url), isSafe: true});
      chrome.action.setIcon({path: "./images/secure-shield.png"});

      urlsInfos.push({url: extractRoot(url), isSafe: true});
    } else {
      // Url isn't Safe //
      var jsonData = JSON.stringify(data);
      addUrl(jsonData.url, false, jsonData.threatType);

      messagePopup({url: extractRoot(jsonData.url), isSafe: false, threatType: jsonData.threatType});
      sendNotification("The extension has detected a malicious site: " + extractRoot(jsonData.url));
      chrome.action.setIcon({path: "./images/unsecured-shield.png"});

      urlsInfos.push({url: extractRoot(url), isSafe: false, threatType: jsonData.threatType});
    }
  }).catch(err => {
    console.log(err);
  });
  }).catch(err => {
    console.log(err);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, response) => {

  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    let url = tabs[0].url;

    // asynchronous call //

    checkUrl(url).then(resp => {
      console.log(resp)
      // Check if the url is safe, then alert the client //
      messagePopup(resp);
      urlsInfos.push(resp);
    });

  });

    return true;
});

// Array of objects, to store urls infos after the user has typed it //
var urlsInfos = [];

chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    let url = tabs[0].url;
    console.log('Active Tab Url: ' + url);

    let urlInfo = urlsInfos.find(obj => obj['url'] == extractRoot(url));
    messagePopup(urlInfo);
  });
});

function messagePopup(data) {
  chrome.runtime.onConnect.addListener(function(port) {
    console.log('Popup Connection Established.');
    port.postMessage(data);
    port.onMessage.addListener(function(msg) {
      port.postMessage(data);
    });
  });
}

function sendNotification(message, requireInteraction) {
  chrome.notifications.create(
    "install-notif",
    {
      type: "basic",
      iconUrl: "./images/secure-shield.png",
      title: "Url Checker",
      message: message,
      requireInteraction: requireInteraction,
    },
    function () {}
  );
}

chrome.runtime.onInstalled.addListener(function(details){
  if(details.reason == "install"){
      // Handle a first install
      sendNotification("The extension is successfully installed!", false);
  }else if(details.reason == "update"){
      // Handle an update
      sendNotification("The extension is successfully updated!", false);
  }
});