

/** 
 * Modules
 */
 var async = require("cloud/async.js");
 var _ = require("cloud/lodash.js");



/** 
 * Constants
 */
// ID of the Google Spreadsheet
var spreadsheetId = "1dLL5tuds0n_Sg_DkEocien0FwIig15hNAwuu_f30amA";

// ID of the Google Spreadsheet
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
 * Parse Cloud Job - importPlaylists
 */
Parse.Cloud.job("importPlaylists", function(request, status) {

	// Use master key
	Parse.Cloud.useMasterKey();


  	// Array to store new objects
	var playlistsToSave = [];

	// Old existing Playlist
	var playlistsToDelete = [];

    //1. Make HTTPRequest to get JSON
    //2. Make Parse object from JSON
    //3. When all HTTPRequest async operations are complete and objects created, save objects
    async.each(individualSheetIds,

        function(sheetId, callback){

            var url = urlForSheet(sheetId);

            // Async cloud function - http request
            Parse.Cloud.httpRequest({
                url: url
            }).then(function(httpResponse) {

                // Parse response
                var json = JSON.parse(httpResponse.buffer);

                var is_invalid = false;

                // Create playlist objects
                for (var i = 0; i < json.feed.entry.length; i++) {


                    // FIRST - Parse JSON
                    var each = json.feed.entry[i];

                    // -- name
                    var name = "";
                    if (each["gsx$name"] &&
                        each["gsx$name"]["$t"].length > 0) {
                        name = each["gsx$name"]["$t"];
                    };

                    // -- playlistid
                    var playlistid = "";
                    if (each["gsx$playlistid"] &&
                        each["gsx$playlistid"]["$t"].length > 0) {
                        playlistid = each["gsx$playlistid"]["$t"];
                    };

                    // -- description
                    var description = "";
                    if (each["gsx$description"] &&
                        each["gsx$description"]["$t"].length > 0) {
                        description = each["gsx$description"]["$t"];
                    };

                    // -- imageurl
                    var imageurl = "";
                    if (each["gsx$imageurl"] &&
                        each["gsx$imageurl"]["$t"].length > 0) {
                        imageurl = each["gsx$imageurl"]["$t"];
                    };

                    // var name = each["gsx$name"]["$t"];
                    // var playlistid = each["gsx$playlistid"]["$t"];
                    // var description = each["gsx$description"]["$t"];
                    // var imageurl = each["gsx$imageurl"]["$t"];


                    // -- categories -- has multiple entries, combine into array
                    var categories = [];
                    for (var j = 0; j < MAX_CATEGORIES; j++) {
                        var key = "gsx$categories" + j;

                        // -- check -- if key exists and value has length
                        if (each[key] &&
                            each[key]["$t"].length > 0) {
                            categories.push(each[key]["$t"]);
                        };
                    }

                    if (!name || !playlistid || categories.length == 0) {
                        is_invalid = true;
                        break;
                    }

                    // SECOND - Create Parse objects
                    var Playlist = Parse.Object.extend("Playlist");
                    var playlist = new Playlist();
                    playlist.set("name", name);
                    playlist.set("playlistId", playlistid);
                    playlist.set("description", description);
                    playlist.set("imageUrl", imageurl);
                    playlist.add("territories", getKey(individualSheetIds, sheetId)); // Get the key from the sheetId
                    playlist.set("categories", categories);
                    playlist.set("active", true);


                    // THIRD - Add to caching array
                    playlistsToSave.push(playlist);
                }

                // Callback for 'each'
                if (!is_invalid) {
                    callback();
                }

            },function(httpResponse) {
                // error
                console.error('Request failed with response code ' + httpResponse.status);

                // status.error("Scheduled messages error: " + error);
                status.error("Scheduled messages error");
            });
        },

        function(err){
            if (err) {
                return;
            }

            // Query
            var Playlist = Parse.Object.extend("Playlist");
            var query = new Parse.Query(Playlist);
            query.equalTo("active", true);

            query.find({
                success: function(results) {
                    _.map(results, function(item) {
                        playlistsToDelete.push(item);
                        item.destroy();
                    });

                    // Async parse operations - Save objects
                    Parse.Object.saveAll(playlistsToSave, {
                        success: function(saveList) {
                            status.success("Objects created successfully.");

                            _.map(playlistsToDelete, function(playlist) {
                                playlist.destroy();
                            });
                        },
                        error: function(error) {
                            status.error("Unable to save objects.");
                        }
                    });
                },
                error: function(error) {

                    alert("Error: " + error.code + " " + error.message);
                }
            });

        }
    );





});

/**
 * Routes
 */

Parse.Cloud.define("getPlaylists2", function(request, response) {

	// FIXME: Logic -- if territory is nil, then just return US playlists by default

	// Parse request
	var territory = "us"; // default
	if (request.params.territory.length > 1) { 
		territory = request.params.territory;
		territory = territory.toLowerCase();
	}

	// Query
    var Playlist = Parse.Object.extend("Playlist");
    var query = new Parse.Query(Playlist);
    query.equalTo("territories", territory);

    query.find({
        success: function(results) {

        	// Parse PFObjects to JSON
        	var resultsJson = [];
			for (var i = 0; i<results.length; i++) {
  				var resultJson = (results[i].toJSON());
  				resultsJson.push(resultJson);
			}

			return response.success(resultsJson); 
        },
        error: function(error) {

            alert("Error: " + error.code + " " + error.message);
        }
    });
});

Parse.Cloud.define("getPlaylists", function(request, response) {
	// Parse request
	var territory = "us"; // default
	if (request.params.territory.length > 1) { 
		territory = request.params.territory;
		territory = territory.toLowerCase();
	}

	// Query
    var Playlist = Parse.Object.extend("Playlist");
    var query = new Parse.Query(Playlist);
    query.equalTo("territories", territory);
    query.equalTo("active", true);

    query.find({
        success: function(results) {

            var categoryObj = {};

        	// Parse PFObjects to JSON
        	var resultsJson = [];
            _.map(results, function(item) {
            
  				var resultJson = (item.toJSON());

                var categories = resultJson.categories;

                _.map(categories, function(category) {
                    var categoryName = category;

                    if (categoryObj[categoryName]) {
                        var arr = categoryObj[categoryName];
                        arr.push(resultJson);
                        categoryObj[categoryName] = arr;
                    } else {
                        categoryObj[categoryName] = [resultJson];
                    }
                });

            });

            _.forEach(categoryObj, function(val, key) {
                var obj = {};
                obj.category = key;
                obj.playlists = val;
                resultsJson.push(obj);
            });

			categoryOrderArray = [
				"Pop",
				"Hip-Hop",
				"Festivals",
                "Country",
                "Indie",
                "Workout",
                "Best Of",
                "Party",
                "Performances",
                "Reggaeton",
                "Rock",
                "Dance",
                "Moods",
                "R&B",
                "Rock",
                "EDM",
                "Latin"
			];

			resultsArray = [];

			_.map(categoryOrderArray, function(category) {
				_.forEach(resultsJson, function(obj) {
					if (category === obj.category) {
						resultsArray.push(obj);
						return false;
					}
                });
			});

			return response.success(resultsArray);
        },
        error: function(error) {

            alert("Error: " + error.code + " " + error.message);
        }
    });
});

Parse.Cloud.define("getCharts", function(request, response) {
    var Chart = Parse.Object.extend("Chart");
    var query = new Parse.Query(Chart);
    query.find({
        success: function(results) {

            // For future reference.
            //var resultsJson = [];
            //for (var i = 0; i < results.length; i++) {
            //    var resultJson = (results[i].toJSON());
            //    var chartVideos = results[i].get("chartVideos");
            //    for (var j = 0; j < chartVideos.length; j++) {
            //
            //    }
            //
            //    resultsJson.push(resultJson);
            //}
            //return response.success(resultJson);

            return response.success(results);

        },
        error: function(error) {
            alert("Error: " + error.code + " " + error.message);
        }
    });
});

/**
*
*/
Parse.Cloud.define("incrementFollowsCount", function(request, response) {

	// Parse request
	var UID;
	if (request.params.UID && request.params.UID.length > 0) { 
		UID = request.params.UID;
	}
	else {
		response.error("Missing parameter - UID -- must provide a UID for the object to increment");
		return;
	}

	var objectType;
	if (request.params.objectType && request.params.objectType.length > 0) { 
		objectType = request.params.objectType;
	}
	else {
		response.error("Missing parameter - objectType -- must provide an objectType for the object to increment");
		return;
	}

	var title;
	if (request.params.title && request.params.title.length > 0) { 
		title = request.params.title;
	}
	else {
		response.error("Missing parameter - title -- must provide an title for the object to increment");
		return;
	}

	var imageUrl;
	if (request.params.imageUrl && request.params.imageUrl.length > 0) { 
		imageUrl = request.params.imageUrl;
	}
	else {
		response.error("Missing parameter - imageUrl -- must provide an imageUrl for the object to increment");
		return;
	}


	// Query
    var FollowCounts = Parse.Object.extend("FollowCounts");
    var query = new Parse.Query(FollowCounts);
    query.equalTo("UID", UID);
    query.equalTo("objectType", objectType);

    query.first({
        success: function(object) {
        		 
        	// Increment and save
        	if (object) {
        		object.increment("count");
        		object.save();
        	}
        	// Create a new object
        	else {

				var FollowCounts = Parse.Object.extend("FollowCounts");
				var followCountsObject = new FollowCounts();
				followCountsObject.set("UID", UID);
				followCountsObject.set("objectType", objectType);
				followCountsObject.set("title", title);
				followCountsObject.set("imageUrl", imageUrl);
				followCountsObject.set("count", 1);
				followCountsObject.save();
        	}
        	

			return response.success(); 
        },
        error: function(error) {

            console.log("Error: " + error.code + " " + error.message);
            return response.error(error); 
        }
    });
});

/**
*
*/
Parse.Cloud.define("decrementFollowsCount", function(request, response) {

	// Parse request
	var UID;
	if (request.params.UID.length > 1) { 
		UID = request.params.UID;
	}

	var objectType;
	if (request.params.objectType.length > 1) { 
		objectType = request.params.objectType;
	}


	// Query
    var FollowCounts = Parse.Object.extend("FollowCounts");
    var query = new Parse.Query(FollowCounts);
    query.equalTo("UID", UID);
    query.equalTo("objectType", objectType);

    query.first({
        success: function(object) {

         	// Decrement and save
			if (object) {				

				// Make sure we don't decrement to negative
				if (object.get("count") > 0) {
					object.increment("count",-1);
        			object.save();
				};       
        	}
        	// Create a new object
        	else {
        		console.log("No object found! We shouldn't be trying to decrement a non-existing object");

        	}
        	

			return response.success(); 
        },
        error: function(error) {

            console.log("Error: " + error.code + " " + error.message);

            return response.error(error); 
        }
    });
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
