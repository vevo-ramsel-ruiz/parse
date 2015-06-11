Parse.Cloud.job("importPlaylists", function(request, status) {

	// Use master key
	Parse.Cloud.useMasterKey();

	// ID of the Google Spreadsheet
	var spreadsheetID = "1dLL5tuds0n_Sg_DkEocien0FwIig15hNAwuu_f30amA";

	// List of country codes and their Google Sheets Ids
	var territories = {
		"us" : "od6",
		"gb" : "olbnsti",
		"it" : "oa6haa5",
		"es" : "oxibv7k",
		"fr" : "obisdv5",
		"nl" : "ohrgz0b",
		"de" : "ocqrxlj",
		"pl" : "oi0umg5"
	}

	var countryCode = "us";
	var sheetID = territories[countryCode];

	var url = "https://spreadsheets.google.com/feeds/list/" + spreadsheetID + "/" + sheetID + "/public/values?alt=json"; // Make sure it is public or set to Anyone with link can view 




	// Cloud function
	Parse.Cloud.httpRequest({
	  url: url
	}).then(function(httpResponse) {
	  
	  // Parse response
	  var json = JSON.parse(httpResponse.buffer);

	  // Array to store new objects
	  var playlistsToSave = [];

	  // Create playlist objects
	  for (var i = 0; i < json.feed.entry.length; i++) {

	  	var each = json.feed.entry[i];
    
    	// TODO: This needs error handling - if "gsx$" doesn't exist will crash
      	var name = each["gsx$name"]["$t"];
      	var playlistid = each["gsx$playlistid"]["$t"];
      	var description = each["gsx$description"]["$t"];
      	var imageurl = each["gsx$imageurl"]["$t"];
      	var categories = each["gsx$categories"]["$t"].split(','); // json returns a string from Sheet - split on commas


      	// -- Logs
        console.log('name = ' + name);
        console.log('playlistid = ' + playlistid);
 		console.log('description = ' + description);
        console.log('imageurl = ' + imageurl);
		// console.log('categories = ' + categories);
		// console.log('categories[1] = ' + categories[1]);


		// Create Parse objects 
		var Playlist = Parse.Object.extend("Playlist");
		var playlist = new Playlist();
		playlist.set("name", name);
		playlist.set("playlistId", playlistid);
		playlist.set("description", description);
		playlist.set("imageUrl", imageurl);
		playlist.set("categories", categories);
		playlist.add("territories", countryCode);


		// -- Logs
		console.log(playlist.playlistid);
		console.log(playlist.get("playlistid"));
		// Add to caching array
		playlistsToSave.push(playlist);


	
      }


      // Parse - Save objects
	  Parse.Object.saveAll(playlistsToSave, {
        success: function(saveList) {
            status.success("Objects created successfully.");
        },
        error: function(error) {
            status.error("Unable to save objects.");
        }
      });


	},function(httpResponse) {
	  // error
	  console.error('Request failed with response code ' + httpResponse.status);

      status.error("Scheduled messages error: " + error);
	});

});


