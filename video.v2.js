// v2 		- 16/08/21	- addition of videoFill and videoVisibility for pausing muted videos off screen
//						- callback fix so player is passed
// v2.01 	- 17/02/22	- addition of 'type' to players in arrVideos
// 						- use of dataset over multiple getAttributes
//						- addition of end value, eg for short video loops
//						- change to data structure pushed to arrVideos
//						- videoVisibility fix for incorrect play/pause
// v2.02	- 06/04/22	- fix with vimeo videos not being pushed to arrVideos!

var arrVideos = [];

(function() {
	
	var w = window,
		blnYouTubeApiReady = false,
		blnVimeoSdkLoaded = false,
		blnVimeoSdkReady = false,
		intVideoCount = 0,
		blnResizeObserver = 'ResizeObserver' in w;
		blnIntersectionObserver = 'IntersectionObserver' in w;

	onYouTubeIframeAPIReady = function() {
		blnYouTubeApiReady = true;
	}

	initYTPlayers = function(newPlayer, callback){
		if (!blnYouTubeApiReady){
			var tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			var firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
		}

		var checkApiReady = setInterval(function(){
				if (blnYouTubeApiReady){
					clearInterval(checkApiReady)
					createYouTubePlayer(intVideoCount, newPlayer);
				}
			}, 200);

		function createYouTubePlayer(i, player) {
			intVideoCount++;
			var objPlayerDataset = player.dataset,
				strVideoID = formatYouTubeURL(objPlayerDataset.videosrc),
				intAutoplay = (objPlayerDataset.autoplay == "true") ? 1 : 0,
				intMute = (objPlayerDataset.mute == "true") ? 1 : 0,
				blnLoop = (objPlayerDataset.loop == "true");
			
			player.insertAdjacentHTML("beforeend", "<div id='ytplayer_" + intVideoCount + "'></div>");
			var youTubePlayer = new YT.Player("ytplayer_" + intVideoCount, {
				videoId: strVideoID,
				playerVars: {
					'autoplay': intAutoplay,
					'controls': 0,
					'disablekb': 1,
					'loop': blnLoop && 1,
					'modestbranding': 1,
					'mute': intMute,
					//'origin': window.location.href,
					'playlist': strVideoID,
					'playsinline': intMute,
					'showinfo': 0
				},
				events: {
					'onReady': onPlayerReady,
					'onStateChange': onPlayerStateChange
				}
			});
			var objVideo = {
				"dataset": objPlayerDataset,
				"element": player,
				"player": youTubePlayer,
				"type": "youtube"
			}
			arrVideos.push(objVideo);
			videoFill(objVideo);

			function onPlayerStateChange(event) {
				event.data == YT.PlayerState.ENDED && callback(objVideo);
			}
			function onPlayerReady(event) {
				blnIntersectionObserver && videoVisibility(objVideo, event.target);
				// autoplay for mobile devices
				intAutoplay == 1 && (event.target.playVideo());

				// custom video end times (end option in API doesn't work forever on loop)
				if (player.dataset.end && player.dataset.end < event.target.getDuration()){
					var videoTimeCheck = setInterval(function(){
						if (parseInt(event.target.getCurrentTime()) >= player.dataset.end){
							if (blnLoop){
								event.target.seekTo(0);
							} else {
								// stopVideo() doesn't change player state to ended, so...
								event.target.seekTo(event.target.getDuration());
								clearInterval(videoTimeCheck);
							}
						}
					}, 1000)
				}
			}
		}
	}

	function formatYouTubeURL(strURL) {
		var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
	    var strMatch = strURL.match(regExp);
	    if (strMatch && strMatch[7].length == 11){
	        strMatch = strMatch[7];
	    } else {
	        console.info('Warning Youtube Link is incorrect on player: ' + strURL);
	    	strMatch = false;
	    }
		return strMatch;
	}

	initVimeoPlayers = function(newPlayer, callback){
		if (!blnVimeoSdkLoaded){
			blnVimeoSdkLoaded = true;
			var tag = document.createElement('script');
			tag.src = 'https://player.vimeo.com/api/player.js';
			var firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
			tag.onload = function(){
				blnVimeoSdkReady = true;
			}
		}
		var checkSdkReady = setInterval(function(){
				if (blnVimeoSdkReady){
					clearInterval(checkSdkReady)
					createVimeoPlayer(intVideoCount, newPlayer);
				}
			}, 10);

		function createVimeoPlayer(i, player) {
			intVideoCount++;
			var objPlayerDataset = player.dataset,
				blnAutoplay = objPlayerDataset.autoplay == 'true',
				blnMuted = objPlayerDataset.mute == 'true',
				blnLoop = objPlayerDataset.loop == 'true';
			var opts = {
				'autoplay': blnAutoplay,
				'byline': false,
				'controls': !blnMuted,
				'id': objPlayerDataset.videosrc,
				'loop': blnLoop,
				'muted': blnMuted,
				'playsinline': blnMuted,
				'title': false
			}

			player.setAttribute('id', 'vimeoplayer_' + intVideoCount);
			var vimeoPlayer = new Vimeo.Player('vimeoplayer_' + intVideoCount, opts),
				objVideo = {
					"dataset": objPlayerDataset,
					"element": player,
					"player": vimeoPlayer,
					"type": "vimeo"
				}
			blnMuted && (vimeoPlayer.setVolume(0));	// fix for volume retrieval
			
			blnIntersectionObserver && videoVisibility(objVideo, vimeoPlayer);
			arrVideos.push(objVideo);
			videoFill(objVideo);

			// custom video end times
			if (player.dataset.end){
				vimeoPlayer.getDuration().then(function(duration) {
					if (player.dataset.end < duration){
						vimeoPlayer.on('timeupdate', function(data) {
							if (data.seconds > player.dataset.end) {
								if (blnLoop){
									vimeoPlayer.setCurrentTime(0);
								} else {
									// seeking to the end doesn't work, so...
									vimeoPlayer.pause();
									callback({ "player": vimeoPlayer, "type": "vimeo" });
								}
							}
						});
					}
				});
			}

			vimeoPlayer.on('ended', function() {
				callback({ "player": vimeoPlayer, "type": "vimeo" });
			});
		}
	}

	function videoVisibility(objVideo, player){
		var videoObserver = new IntersectionObserver(function(entries) {
			switch (objVideo.type) {
				case "youtube":
					if (player.isMuted()){
						var playerState = player.getPlayerState();
						if (playerState == 2){
							entries[0].isIntersecting && player.playVideo();
						} else if (playerState == 1) {
							!entries[0].isIntersecting && player.pauseVideo();
						}
					}
					break;
				case "vimeo":
					player.getVolume().then(function(volume) {
						if (volume == 0){
							player.getPaused().then(function(blnPaused) {
								if (blnPaused){
									entries[0].isIntersecting && player.play()
								} else {
									!entries[0].isIntersecting && player.pause()
								}
							});
						}
					});
					break;
			}
		}, { rootMargin: '0px 0px 0px 0px' });
		videoObserver.observe(objVideo.element);
	}

	function videoFill(objVideo){
		if (objVideo.dataset.videofill != undefined){
			videoFillTo = document.querySelector(objVideo.dataset.videofill);
			if (blnResizeObserver){
				var obsResizeVideo = new ResizeObserver(function(entries) {
					videoFillResize();
				});
				obsResizeVideo.observe(videoFillTo);
			}

			videoFillResize();
			window.addEventListener('resize', function(){
				videoFillResize();
			})
	
			function videoFillResize(){
				var ratio = (16/9),
					fillW = videoFillTo.clientWidth,
					fillH = videoFillTo.clientHeight,
					playerW, playerH;	
					
				if (fillW / ratio < fillH) {
					playerW = Math.ceil(fillH * ratio);
					objVideo.element.style.width = playerW + "px";
					objVideo.element.style.height = fillH + "px";
				} else {
					playerH = Math.ceil(fillW / ratio);
					objVideo.element.style.width = fillW + "px";
					objVideo.element.style.height = playerH + "px";
				}
				objVideo.element.style.top = "50%";
				objVideo.element.style.left = "50%";
				objVideo.element.style.bottom = "auto";
				objVideo.element.style.right = "auto";
				objVideo.element.style.transform = "translate(-50%, -50%)";
			}
		}
	}

	checkPlayers = function(targ, callback){
		var players = document.querySelectorAll(targ),
			intPlayers = players.length;
		for (p=0; p<intPlayers; p++){
			if (players[p].getAttribute('data-videosrc').indexOf('youtu') > -1){
				initYTPlayers(players[p], function(data){
					callback(data);
				})
			} else if (players[p].getAttribute('data-videosrc').indexOf('vimeo') > -1){
				initVimeoPlayers(players[p], function(data){
					callback(data);
				})
			} else {
				console.log('Video source is not supported');
			}
			players[p].classList.add('video--init');
		}
	}

})();