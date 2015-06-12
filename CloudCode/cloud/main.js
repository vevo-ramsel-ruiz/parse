
// Modules
var async = require("cloud/async.js");

// ID of the Google Spreadsheet
var spreadsheetId = "1dLL5tuds0n_Sg_DkEocien0FwIig15hNAwuu_f30amA";

var MAX_CATEGORIES = 10;

// List of country codes and their Google Sheets Ids
var individualSheetIds = {
	"us" : "od6",
	"gb" : "olbnsti",
	"it" : "oa6haa5",
	"es" : "oxibv7k",
	"fr" : "obisdv5",
	"nl" : "ohrgz0b",
	"de" : "ocqrxlj",
	"pl" : "oi0umg5"
}


/** 
 *
 */
Parse.Cloud.job("importPlaylists", function(request, status) {

	// Use master key
	Parse.Cloud.useMasterKey();


  	// Array to store new objects
	var playlistsToSave = [];



	// 1. Make HTTPRequest to get JSON
	// 2. Make Parse object from JSON
	// 3. When all HTTPRequest async operations are complete and objects created, save objects
	async.each(individualSheetIds,

	 function(sheetId, callback){

	 	var url = urlForSheet(sheetId);

	    // Async cloud function - http request
		Parse.Cloud.httpRequest({
		  url: url
		}).then(function(httpResponse) {
		  
		  // Parse response
		  var json = JSON.parse(httpResponse.buffer);

		  // Create playlist objects
		  for (var i = 0; i < json.feed.entry.length; i++) {

		  	var each = json.feed.entry[i];
	    
	    	// TODO: This needs error handling - if "gsx$.." doesn't exist will crash
	      	var name = each["gsx$name"]["$t"];
	      	var playlistid = each["gsx$playlistid"]["$t"];
	      	var description = each["gsx$description"]["$t"];
	      	var imageurl = each["gsx$imageurl"]["$t"];


	      	// -- categories has multiple entries, combine into array
	      	var categories = [];
	      	for (var j = 0; j < MAX_CATEGORIES; j++) { 

	      		var key = "gsx$categories" + j;
	      		
	      		// -- check -- if key exists and value has length
	      		if (each[key] &&
	      			each[key]["$t"].length > 0) {
	      			categories.push(each[key]["$t"]);
	      		};
	      	}


			// Create Parse objects 
			var Playlist = Parse.Object.extend("Playlist");
			var playlist = new Playlist();
			playlist.set("name", name);
			playlist.set("playlistId", playlistid);
			playlist.set("description", description);
			playlist.set("imageUrl", imageurl);
			playlist.add("territories", getKey(individualSheetIds, sheetId)); // Get the key from the sheetId
			playlist.set("categories", categories);



			// Add to caching array
			playlistsToSave.push(playlist);
	      }

	      // Callback for 'each'
	      callback();


		},function(httpResponse) {
		  // error
		  console.error('Request failed with response code ' + httpResponse.status);

	      // status.error("Scheduled messages error: " + error);
  	      status.error("Scheduled messages error");
		});
	  },

	  function(err){
	   
	   	// Async parse operations - Save objects
		Parse.Object.saveAll(playlistsToSave, {
	    success: function(saveList) {
	        status.success("Objects created successfully.");
	    },
	    error: function(error) {
	        status.error("Unable to save objects.");
	    }
	  	});
	  }
	);


});


/**
*
*/
function urlForSheet(sheetId) {

	return "https://spreadsheets.google.com/feeds/list/" + spreadsheetId + "/" + sheetId + "/public/values?alt=json"; // Make sure it is public or set to Anyone with link can view 
}


/**
*
*/
function getKey(object, value) {
  for(var key in object){
    if(object[key] == value){
      return key;
    }
  }
  return null;
};
