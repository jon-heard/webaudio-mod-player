
class ModInteractivePlayer {
	constructor(mod = undefined) {
		this.mod = mod || new Modplayer();
		this.mod.onSongRowChange = this.onRowChange.bind(this);
		this.mod.onSongPatternChange = this.onPatternChange.bind(this);
		this.rowDelayedActions = [];
		this.patternDelayedActions = [];
	}

	onRowChange() {
		const actions = this.rowDelayedActions;
		this.rowDelayedActions = [];
		actions.forEach(action => this.runAction(action));
	}

	onPatternChange() {
		const actions = this.patternDelayedActions;
		this.patternDelayedActions = [];
		actions.forEach(action => this.runAction(action));
	}

	load(url) {
		const originalOnReady = this.mod.onReady;
		const originalOnFailure = this.mod.onFailure;
		let returnedPromiseResolve = null;
		const returnedPromise = new Promise(resolve => returnedPromiseResolve = resolve);
		const onFinished = (result) => {
			this.mod.onReady = originalOnReady;
			this.mod.onFailure = originalOnFailure;
			returnedPromiseResolve(result);
		};
		this.mod.onReady = () => onFinished(true);
		this.mod.onFailure = () => onFinished(false);
		if (!this.mod.load(url)) {
			resultResolve(false);
		}
		return returnedPromise;
	}

	play(forceRepeat = false) {
		this.mod.setrepeat(forceRepeat);
		this.mod.play();
	}

	runAction(action) {
		switch (action.type) {
			case 'stop':
				this.mod.stop();
				break;
			case 'setChannelMute':
			{
				const channel = this.mod.player.channel[action.channelIndex];
				if (!channel) return;
				channel.interactiveMute = action.muted;
				break;
			}
			case 'setChannelVolume':
			{
				const channel = this.mod.player.channel[action.channelIndex];
				if (!channel) return;
				channel.interactiveVolume = action.volume || 1.0;
				break;
			}
			case 'fadechannel':
			{
				const channel = this.mod.player.channel[action.channelIndex];
				if (!channel) return;
				// "originalVolume" isn't assigned at start.  Condition on it for initializing action-thread.
				if (action.originalVolume == undefined) {
					// Don't do user-defined fade if already faded
					if (!!action.fadeIn !== !!channel.interactiveMute) return;
					action.originalVolume = channel.interactiveVolume;
					action.volumeChangePerRow = action.originalVolume / (action.speed || 64);
					if (action.fadeIn) {
						channel.interactiveVolume = 0;
						channel.interactiveMute = false;
					} else {
						action.volumeChangePerRow *= -1;
					}
				}
				// Advance fade
				channel.interactiveVolume += action.volumeChangePerRow;
				// Check if fade is finished.  If so, wrap up.  If not, re-post to advance.
				if (!action.fadeIn && channel.interactiveVolume <= 0) {
					// Fade-out is finished
					channel.interactiveMute = true;
					channel.interactiveVolume = action.originalVolume;
				} else if (action.fadeIn && channel.interactiveVolume >= action.originalVolume) {
					// Fade-in is finished
					channel.interactiveVolume = action.originalVolume;
				} else {
					// Fade isn't finished, add a new action to advance this action-chain
					this.rowDelayedActions.push(action);
				}
				break;
			}
		}
	}

	stop(runAtPatternChange = false) {
		const action = { type: 'stop' };
		if (runAtPatternChange) {
			this.patternDelayedActions.push(action);
		} else {
			this.runAction(action);
		}
	}

	setChannelMute(channelIndex, muted = true, runAtPatternChange = false) {
		const action = { type: 'setChannelMute', channelIndex, muted };
		if (runAtPatternChange) {
			this.patternDelayedActions.push(action);
		} else {
			this.runAction(action);
		}
	}

	setChannelVolume(channelIndex, volume = 1.0, runAtPatternChange = false) {
		const action = { type: 'setChannelVolume', channelIndex, volume };
		if (runAtPatternChange) {
			this.patternDelayedActions.push(action);
		} else {
			this.runAction(action);
		}
	}

	fadeChannel(channelIndex, fadeIn = false, speed = 64, runAtPatternChange = false) {
		const action = { type: 'fadechannel', channelIndex, fadeIn, speed };
		if (runAtPatternChange) {
			this.patternDelayedActions.push(action);
		} else {
			this.runAction(action);
		}
	}
}
