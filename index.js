var https = require('https');
var http = require('http');
var fs = require('fs');
var format = require('string-format');
var minimist = require('minimist');
var path = require('path');
var sync  = require('synchronize');
var request = require('sync-request');

let dataPath = "";

var argv = minimist(process.argv.slice(2));

var file;
var basePath;

var fileList = [];

if(argv["file"]) {
	file = argv["file"];
} else {
	if(argv["datapath"]) {
		dataPath = argv["datapath"];
	}
}

let imagesRelativePath = "images/";
let csvRelativePath = "csv/";
let jsonRelativePath = "json/";

var jsonPath = dataPath + jsonRelativePath;
var csvPath = dataPath + csvRelativePath;
var imagesPath = dataPath + imagesRelativePath;

fs.readdirSync(jsonPath).forEach(file => {
	if(path.extname(file) == ".json") {
		fileList.push(file);
	}
});

for(file in fileList) {
	file = fileList[file];

	console.log("Processing file: " + file);

	fileContent = fs.readFileSync(jsonPath + file);

	var jsonData = JSON.parse(fileContent);

	var numberOfCard = jsonData.cards.length;
	console.log("Processing " + jsonData.cards.length + " cards");

	console.log("Processing lists ids");

	var output = [];

	//retrieve lists ids
	for(cardsIndex in jsonData.cards) {
		var currentCard = jsonData.cards[cardsIndex];
		output.push({ idcard: currentCard.id, name: currentCard.name, closed: currentCard.closed, listname: "",  attachementsUrls: [], checklists: [], comments: [] });
	}
	//translate lists ids to lists names
	for(cardsIndex in jsonData.cards) {
		var currentCard = jsonData.cards[cardsIndex];

		var listname = "";
		var listid = jsonData.cards[cardsIndex].idList;

		console.log("Searching list name for id: " + listid);

		for(listIndex in jsonData.lists) {
			if(jsonData.lists[listIndex].id == listid) {
				listname = jsonData.lists[listIndex].name;
				break;
			}
		}

		for(outputIndex in output) {
			if(currentCard.name == output[outputIndex].name) {
				output[outputIndex].listname = listname;
			}
		}
	}

	console.log("Processing attachements");

	//download attachements and trans attachement id to relative path
	for(cardsIndex in jsonData.cards) {
		var currentCard = jsonData.cards[cardsIndex];

		console.log(format("Processing card ({0}/{1}): {2}", cardsIndex, numberOfCard, currentCard.attachments));

		for(attachementIndex in currentCard.attachments) {
			var currentAttachement = currentCard.attachments[attachementIndex];

			console.log(format('Processing attachement ({0}/{1}): {2} - {3}', attachementIndex, currentCard.attachments.length, currentAttachement.id, currentAttachement.url));

			for(outputIndex in output) {
				if(currentCard.name == output[outputIndex].name) {
					output[outputIndex].attachementsUrls.push(currentAttachement.url);
				}
			}
		}
	}

	console.log("Processing comments");

	//retrieve comments
	//comments are stored in action
	// Action: id, idMemberCreator, data: {board, list, card}, type: (createCard, commentCard),
	// date, memberCreator {}
	for(cardsIndex in jsonData.cards) {
		var currentCard = jsonData.cards[cardsIndex];

		console.log(format("Processing card ({0}/{1}): {2}", cardsIndex, numberOfCard, currentCard.id));

		var numberOfActions = jsonData.actions.length;

		//we must process all actions
		//and search for type "commentCard"
		for(actionIndex in jsonData.actions) {
			var currentAction = jsonData.actions[actionIndex];

			//console.log(format("Processing action ({0}/{1}): {2}", actionIndex, numberOfActions, currentAction.id));

			if(currentAction.type == "commentCard" && currentAction.data.card.id == currentCard.id) {
				for(outputIndex in output) {
					if(currentCard.name == output[outputIndex].name) {
						output[outputIndex].comments.push(currentAction.data.text);
					}
				}
			}
		} 
	}

	console.log("Processing checklists");

	// Checklists
	for(cardsIndex in jsonData.cards) {
		var currentCard = jsonData.cards[cardsIndex];

		console.log(format("Processing card ({0}/{1}): {2}", cardsIndex, numberOfCard, currentCard.id));

		var checklistsids = currentCard.idChecklists;
		var numberOfCheckLists = checklistsids.length;

		for(checklistsIdsIndex in checklistsids) {
			var checkListId = checklistsids[checklistsIdsIndex];

			for(checkListIndex in jsonData.checklists) {
				var currentCheckList = jsonData.checklists[checkListIndex];

				if(checkListId == currentCheckList.id) {
					var itemArray = [];

					for(itemIndex in currentCheckList.checkItems) {
						itemArray.push(currentCheckList.checkItems[itemIndex].name);
					}

					for(outputIndex in output) {
						if(currentCard.name == output[outputIndex].name) {
							output[outputIndex].checklists.push({name: currentCheckList.name, items: itemArray});
						}
					}
				}
			}
		}
	}

	console.log("Processing labels");

	// labels
	for(cardsIndex in jsonData.cards) {
		var currentCard = jsonData.cards[cardsIndex];

		console.log(format("Processing card ({0}/{1}): {2}", cardsIndex, numberOfCard, currentCard.id));

		var labels = [];

		for(labelIndex in currentCard.idLabels) {
			var labelID = currentCard.idLabels[labelIndex];

			for(realLabelIndex in jsonData.labels) {
				var label = jsonData.labels[realLabelIndex];

				if(label.id == labelID) {
					labels.push(label.name);
				}
			}
		}

		output.labels = labels
	}

	//formatting to csv
	var formatString = "{0},{1},{2},{3},{4},{5},{6},{7}\n";
	var headers = format(formatString, "List", "Name", "Description", "Attachement", "Comments", "Checklist", "Closed", "Labels");

	out = "";
	out += headers;

	for(cardsIndex in output) {
		var currentCard = output[cardsIndex];

		var attachements = "";

		if(currentCard.attachementsUrls && currentCard.attachementsUrls.length > 0) {
			for(attachementID in currentCard.attachementsUrls) {
				if(currentCard.attachementsUrls[attachementID].length > 0) {	
					attachements += currentCard.attachementsUrls[attachementID] + "&";
				}
			}
		}


		var comments = "";

		for(commentsID in currentCard.comments) {
			comments += currentCard.comments[commentsID] + "&";
		}

		comments = comments.replace(/\n/g, " ")

		var labels = "";

		for(labelID in currentCard.labels) {

			labels += currentCard.labels[labelID] + "&";
		}



		var checklists = "";

		for(checklistID in currentCard.checklists) {
			checklists += "(" + currentCard.checklists[checklistID].name + ")";

			for(itemIndex in currentCard.checklists[checklistID].items) {
				checklists += currentCard.checklists[checklistID].items[itemIndex] + "&";
			}
		}

		//formatting line
		var line = format(formatString, currentCard.listname, currentCard.name, currentCard.desc, attachements, comments, checklists, currentCard.closed, labels);

		//adding line to output
		out += line;
	}

	//console.log(out);

	//writing csv
	fs.writeFileSync(csvPath + file + ".csv", out);

	for(cardsIndex2 in output) {
		var currentCard = output[cardsIndex2];

		if(currentCard.attachementsUrls && currentCard.attachementsUrls.length > 0) {
			for(attachementID in currentCard.attachementsUrls) {
				if(currentCard.attachementsUrls[attachementID].length > 0) {	

					var url = currentCard.attachementsUrls[attachementID];
					
					var filename = file + currentCard.idcard + attachementID + ".jpg";

					console.log("Downloading : " + url);
					console.log("path : " +  imagesPath + filename);

					var res = request('GET', url);

					if(res.statusCode == 200) {
						fs.writeFileSync(imagesPath + file + currentCard.idcard + attachementID + ".jpg", res.getBody());
					}
				}
			}
		}
	}
}