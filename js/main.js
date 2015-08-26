(function ($) {
	"use strict";

	if (!String.prototype.trim) {
		String.prototype.trim = function () {
			return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
		};
	}

	function normalize (s) {
		return s.trim().replace(/[\s\uFEFF\xA0]+/g, ' ').toLowerCase();
	}

	function parseQuery (query) {
		var words = [];
		var re = /\s*(?:([^\s\uFEFF\xA0"]+)|"((?:[^"\\]|\\"|\\\\)*)")\s*/g;
		var m;
		while ((m = re.exec(query))) {
			if (m[1]) {
				words.push(m[1]);
			}
			else {
				words.push(m[2].replace(/\\"|\\\\/g,function (s) { return s === '\\"' ? '"' : '\\'; }));
			}
		}
		return words;
	}

	var hasOwnProperty = Object.prototype.hasOwnProperty;

	var TwitchSearch = {
		_videos: [],
		download: function (channel, callback, finished) {
			if (TwitchSearch._xhr) {
				TwitchSearch._xhr.abort();
			}

			callback("downloading highlight info...");

			var pagesize = 100;
			var url = 'https://api.twitch.tv/kraken/channels/'+channel+'/videos';
			var videos = [];
			var offset = 0;

			TwitchSearch._xhr = $.ajax({
				url: url,
				jsonp: 'callback',
				dataType: 'jsonp',
				data: {limit: pagesize}
			}).done(done).fail(fail);

			function done (data) {
				if (data.error) {
					callback(data.message);
					TwitchSearch._xhr = null;
					return;
				}
				var total = data._total;
				for (var i = 0; i < data.videos.length; ++ i) {
					var video = data.videos[i];
					video.tag_list = video.tag_list ? video.tag_list.split(",") : [];
					video.tag_map  = {};
					for (var j = 0; j < video.tag_list.length; ++ j) {
						var tag = video.tag_list[j] = normalize(video.tag_list[j]);
						video.tag_map[tag] = true;
					}
					video.fulltext = video.title+' '+video.description;
					if (video.game) video.fulltext += ' '+video.game;
					video.fulltext = video.fulltext.toLowerCase();
					videos.push(video);
				}

				callback("downloaded "+offset+" to "+(offset + data.videos.length)+" of "+data._total);
				if (videos.length < data._total) {
					TwitchSearch._xhr = $.ajax({
						url: url,
						jsonp: 'callback',
						dataType: 'jsonp',
						data: {limit: pagesize, offset: offset + data.videos.length}
					}).done(done).fail(fail);
				}
				else {
					TwitchSearch._videos = videos;
					callback("finished");
					if (finished) finished();
				}
				offset += data.videos.length;
			}

			function fail (xhr, status, error) {
				if (status !== 'abort') {
					alert("Error: "+(status||error));
				}
				TwitchSearch._xhr = null;
			}
		},
		search: function (query, callback) {
			var results = [];
			var words = parseQuery(query);

			for (var i = 0; i < TwitchSearch._videos.length; ++ i) {
				var video = TwitchSearch._videos[i];
				var order = 0;
				var found = 0;
				for (var j = 0; j < words.length; ++ j) {
					var word = words[j];
					var hasWord = false;
					if (video.fulltext.indexOf(word) >= 0) {
						hasWord = true;
					}
					if (video.tag_map[word] === true) {
						++ order;
						hasWord = true;
					}
					if (hasWord) {
						++ found;
					}
				}
				if (found >= words.length) {
					results.push({
						order: order,
						video: video
					});
				}
			}

			results.sort(function (lhs, rhs) {
				var cmp = rhs.order - lhs.order;
				if (cmp !== 0) return cmp;
				var lt = lhs.video.title;
				var rt = rhs.video.title;
				if (lt < rt) return -1;
				else if (lt > rt) return 1;
				return 0;
			});
				
			for (var i = 0; i < results.length; ++ i) {
				results[i] = results[i].video;
			}

			callback(results);
		}
	};

	$(document).ready(function () {
		$('#download_form').submit(function () {
			var $log = $('#log').empty();
			TwitchSearch.download($('#channel').val(), function (progressMessage) {
				$log.append($('<li>').text(progressMessage));
			});
		});
		
		$('#search_form').submit(function () {
			var $results = $('#results').empty().append(
				$('<tr>').append($('<td colspan="5">').text('Searching...')));
			TwitchSearch.search($('#q').val(), function (results) {
				$results.empty();

				if (results.length === 0) {
					$results.append(
						$('<tr>').append($('<td colspan="5">').text('Nothing found')));
				}
				else {
					for (var i = 0; i < results.length; ++ i) {
						var video = results[i];
						var $tr = $('<tr>').
							append($('<td>').append($('<a>',{href:video.url}).append($('<img>',{'class':'preview',src:video.preview})))).
							append($('<td>').append($('<a>',{href:video.url}).text(video.title))).
							append($('<td>').text(video.game||'N/A')).
							append($('<td>').text(video.tag_list.length === 0 ? 'N/A' : video.tag_list.join(', '))).
							append($('<td>').text(video.description));

						$results.append($tr);
					}
				}
			});
		});
	});

})(jQuery);
