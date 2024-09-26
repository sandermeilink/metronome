window.onload = (event) => {
    const bpmDisplay = document.getElementById('bpm');
    const tempoNameDisplay = document.getElementById('tempoName');
    const bpmSlider = document.getElementById('bpmSlider');
    const blocks = document.querySelectorAll('.block');
    const beepSound = document.getElementById('beepSound');
    const lowerBeepSound = document.getElementById('lowerBeepSound');
    const toggleButton = document.getElementById('toggleButton');
    const tapButton = document.getElementById('tapButton');
    const minusButton = document.getElementById('minusButton');
    const plusButton = document.getElementById('plusButton');
    const threeQuarterButton = document.getElementById('threeQuarterButton');
    const fourQuarterButton = document.getElementById('fourQuarterButton');
    const studyButton = document.getElementById('studyButton');
    const studyOptions = document.getElementById('studyOptions');
    const bpmIncrementInput = document.getElementById('bpmIncrement');
    //const incrementIntervalInput = document.getElementById('incrementInterval');
    const incrementMinutesInput = document.getElementById('incrementMinutes');
    const incrementSecondsInput = document.getElementById('incrementSeconds');

    const studyTimers = document.getElementById('timers');
    const totalTimer = document.getElementById('totalTimer');
    const countdownTimer = document.getElementById('countdownTimer');

    let bpm = 120;
    let isPlaying = false;
    let currentBeat = 0;
    let intervalId;
    let timeSignature = 4;
    let tapTimes = [];
    let lastTapTime = 0;
    let studyMode = false;
    let totalStudyTime = 0;
    let countdownTime = 0;
    let totalTimerId;
    let countdownTimerId;
    let nextBpmIncrease = null;

    const tempoRanges = [
        { name: "Largo", min: 40, max: 60 },
        { name: "Lento", min: 52, max: 68 },
        { name: "Adagio", min: 60, max: 80 },
        { name: "Andante", min: 76, max: 100 },
        { name: "Moderato", min: 88, max: 112 },
        { name: "Allegretto", min: 100, max: 128 },
        { name: "Allegro", min: 112, max: 160 },
        { name: "Vivace", min: 140, max: 140 },
        { name: "Presto", min: 140, max: 200 },
        { name: "Prestissimo", min: 188, max: Infinity }
    ];



    /*=========
    WakeLock - To prevent sleeping / time out while using the metronome
    ================*/
    let wakeLock = null;

    if ('wakeLock' in navigator) {
        // Wake Lock is supported
    } else {
        console.log('Wake Lock API not supported.');
    }

    async function requestWakeLock() {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock was released');
            });
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release()
                .then(() => {
                    wakeLock = null;
                });
        }
    }


    /*=========
    Web Audio API
    ================*/
    let audioContext;
    let tickBuffer;
    let lowerTickBuffer;

    // Initialize Web Audio API
    function initAudio() {
        loadSound('sounds/Perc_MetronomeQuartz_hi.mp3', buffer => tickBuffer = buffer);
        loadSound('sounds/Perc_MetronomeQuartz_lo.mp3', buffer => lowerTickBuffer = buffer);
    }

    function loadSound(url, callback) {
        fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(audioBuffer => callback(audioBuffer));
    }

    function playSound(buffer) {
        if (audioContext && audioContext.state === 'running') {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        }
    }

    function getTempoName(bpm) {
        let tempoNames = tempoRanges.filter(tempo => bpm >= tempo.min && bpm <= tempo.max).map(tempo => tempo.name);
        return tempoNames.join(' - ') || 'Unknown';
    }

    function updateBPM(value) {
        bpm = Math.max(40, Math.min(300, value));
        bpmSlider.value = bpm;
        bpmDisplay.textContent = `${bpm} BPM`;
        tempoNameDisplay.textContent = getTempoName(bpm);
        if (isPlaying) {
            startBeatInterval();
        }
    }

    function handleTap() {
        const currentTime = Date.now();
        if (lastTapTime !== 0) {
            const tapInterval = currentTime - lastTapTime;
            tapTimes.push(tapInterval);
            if (tapTimes.length > 4) {
                tapTimes.shift();
            }
            if (tapTimes.length >= 2) {
                const averageInterval = tapTimes.reduce((a, b) => a + b) / tapTimes.length;
                const tappedBPM = Math.round(60000 / averageInterval);
                updateBPM(tappedBPM);
            }
        }
        lastTapTime = currentTime;
    }

    function toggleMetronome() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            initAudio();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        if (isPlaying) {
            stopMetronome();
        } else {
            startMetronome();
        }
    }

    function startMetronome() {
        isPlaying = true;
        toggleButton.innerHTML = '&#9724;';

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        startBeatInterval();

        if (studyMode) {
            startStudyMode();
        }
        else {
            resetCountdownTimer();
            startTotalTimer();
        }

        // Request wake lock when metronome starts
        requestWakeLock();
    }

    function stopMetronome() {
        isPlaying = false;
        toggleButton.innerHTML = '&#9654;';
        clearInterval(intervalId);
        currentBeat = 0;
        blocks.forEach(block => block.classList.remove('active'));

        if (studyMode) {
            stopStudyMode();
        }

        // Release wake lock when metronome stops
        releaseWakeLock();
    }

    function startBeatInterval() {
        clearInterval(intervalId);
        const interval = 60000 / bpm;
        let nextNotetime = audioContext.currentTime;
        intervalId = setInterval(playBeat, interval);
    }

    function playBeat() {
        blocks.forEach(block => block.classList.remove('active'));
        blocks[currentBeat].classList.add('active');

        if (currentBeat === 0) {
            /*beepSound.load();
            //beepSound.currentTime = 0;
            beepSound.play();
            */
            playSound(tickBuffer);

            if (studyMode && nextBpmIncrease !== null && Date.now() >= nextBpmIncrease) {
                increaseBPM();
            }
        } else {
            /*lowerBeepSound.load();
            //lowerBeepSound.currentTime = 0;
            lowerBeepSound.play();
            */
            playSound(lowerTickBuffer);
        }

        currentBeat = (currentBeat + 1) % timeSignature;
    }

    function setTimeSignature(newTimeSignature) {
        timeSignature = newTimeSignature;
        blocks.forEach((block, index) => {
            block.style.display = index < timeSignature ? 'block' : 'none';
        });
        threeQuarterButton.classList.toggle('active-time-signature', timeSignature === 3);
        fourQuarterButton.classList.toggle('active-time-signature', timeSignature === 4);
        currentBeat = 0;
    }

    function startStudyMode() {
        const incrementMinutes = parseInt(incrementMinutesInput.value) || 0;
        const incrementSeconds = parseInt(incrementSecondsInput.value) || 0;
        const incrementInterval = (incrementMinutes * 60 + incrementSeconds) * 1000; // Convert to milliseconds
        
        resetCountdownTimer();
        startTotalTimer();
        
        scheduleNextBpmIncrease(incrementInterval);
    }

    function scheduleNextBpmIncrease(incrementInterval) {
        nextBpmIncrease = Date.now() + incrementInterval;
    }

    function increaseBPM() {
        const bpmIncrement = parseInt(bpmIncrementInput.value);
        updateBPM(bpm + bpmIncrement);
        const incrementMinutes = parseInt(incrementMinutesInput.value) || 0;
        const incrementSeconds = parseInt(incrementSecondsInput.value) || 0;
        const incrementInterval = (incrementMinutes * 60 + incrementSeconds) * 1000;
        scheduleNextBpmIncrease(incrementInterval);
        resetCountdownTimer();
        //startBeatInterval();
    }

    function stopStudyMode() {
        clearInterval(totalTimerId);
        clearInterval(countdownTimerId);
        totalStudyTime = 0;
        countdownTime = 0;
        nextBpmIncrease = null;
        updateTimerDisplay(totalTimer, 0);
        updateTimerDisplay(countdownTimer, 0);
    }

    function resetCountdownTimer() {
        const incrementMinutes = parseInt(incrementMinutesInput.value) || 0;
        const incrementSeconds = parseInt(incrementSecondsInput.value) || 0;
        countdownTime = incrementMinutes * 60 + incrementSeconds;
        updateTimerDisplay(countdownTimer, countdownTime);
        clearInterval(countdownTimerId);
        countdownTimerId = setInterval(() => {
            countdownTime--;
            updateTimerDisplay(countdownTimer, countdownTime);
            if (countdownTime <= 0) {
                clearInterval(countdownTimerId);
            }
        }, 1000);
    }

    function startTotalTimer() {
        clearInterval(totalTimerId);
        totalTimerId = setInterval(() => {
            totalStudyTime++;
            updateTimerDisplay(totalTimer, totalStudyTime);
        }, 1000);
    }

    function updateTimerDisplay(timerElement, timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = timeInSeconds % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }


    /*=========
    Study Time Spinners
    ================*/
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }
    function updateIncrementTime() {
        let minutes = parseInt(incrementMinutesInput.value) || 0;
        let seconds = parseInt(incrementSecondsInput.value) || 0;

        // Adjust if seconds are 60 or more
        if (seconds >= 60) {
            minutes += Math.floor(seconds / 60);
            seconds = seconds % 60;
        }

        // Ensure minutes don't exceed 59
        minutes = Math.min(59, minutes);

        incrementMinutesInput.value = padZero(minutes);
        incrementSecondsInput.value = padZero(seconds);
    }

    incrementMinutesInput.addEventListener('change', function() {
        enforceMinMax(this);
        updateIncrementTime();
    });

    incrementSecondsInput.addEventListener('change', function() {
        enforceMinMax(this);
        updateIncrementTime();
    });


    // Custom spinners
    function createSpinner(input, step) {
        const wrapper = document.createElement('div');
        wrapper.className = 'spinner-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const up = document.createElement('button');
        up.textContent = '▲';
        up.className = 'spinner-up';
        wrapper.appendChild(up);

        const down = document.createElement('button');
        down.textContent = '▼';
        down.className = 'spinner-down';
        wrapper.appendChild(down);

        up.addEventListener('click', () => {
            input.value = parseInt(input.value) + step;
            input.dispatchEvent(new Event('change'));
        });

        down.addEventListener('click', () => {
            input.value = parseInt(input.value) - step;
            input.dispatchEvent(new Event('change'));
        });
    }

    function enforceMinMax(input) {
        const value = parseInt(input.value) || 0;
        const min = parseInt(input.min);
        const max = parseInt(input.max);
        input.value = Math.max(min, Math.min(max, value));
    }

    createSpinner(incrementMinutesInput, 1);
    createSpinner(incrementSecondsInput, 15);

    // Prevent negative input on keydown
    function preventNegativeInput(event) {
        if (event.key === '-' || event.key === 'e') {
            event.preventDefault();
        }
    }

    incrementMinutesInput.addEventListener('keydown', preventNegativeInput);
    incrementSecondsInput.addEventListener('keydown', preventNegativeInput);

    // Ensure non-negative values on blur (when user leaves the input field)
    incrementMinutesInput.addEventListener('blur', function() {
        if (this.value === '' || parseInt(this.value) < 0) {
            this.value = '00';
        }
        updateIncrementTime();
    });

    incrementSecondsInput.addEventListener('blur', function() {
        if (this.value === '' || parseInt(this.value) < 0) {
            this.value = '00';
        }
        updateIncrementTime();
    });


    bpmSlider.addEventListener('input', (e) => updateBPM(parseInt(e.target.value)));
    minusButton.addEventListener('click', () => updateBPM(bpm - 1));
    plusButton.addEventListener('click', () => updateBPM(bpm + 1));
    toggleButton.addEventListener('click', toggleMetronome);
    tapButton.addEventListener('click', handleTap);

    threeQuarterButton.addEventListener('click', () => setTimeSignature(3));
    fourQuarterButton.addEventListener('click', () => setTimeSignature(4));

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            toggleMetronome();
        }
    });

    studyButton.addEventListener('click', () => {
        studyMode = !studyMode;
        studyOptions.style.display = studyMode ? 'block' : 'none';
        countdownTimer.parentNode.style.display = studyMode ? 'block' : 'none';
        studyButton.textContent = studyMode ? '▲ Hide Study Options' : '▼ Study';
        if (!studyMode) {
            stopStudyMode();
        }
    });

    // Initialize Audio & Preload
    initAudio();

    // Initialize the metronome
    setTimeSignature(4);
    updateBPM(120);

    function adjustContainerSize() {
        const container = document.querySelector('.container');
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Adjust height
        container.style.height = `${viewportHeight}px`;

        // Adjust width for smaller screens
        if (viewportWidth > 599) {
            container.style.width = '600px';
            container.style.height = 'inherit';
            container.style.marginTop = 'inherit';
        } else {
            container.style.width = '400px';
            container.style.height = '100%';
            container.style.marginTop = '0px';
        }

        // Adjust font size based on viewport width
        const baseFontSize = Math.min(16, Math.max(12, viewportWidth / 25));
        document.documentElement.style.fontSize = `${baseFontSize}px`;
    }

    // Call on load and resize
    window.addEventListener('load', adjustContainerSize);
    window.addEventListener('resize', adjustContainerSize);


    // Automatic WakeLoc request in case of screen sleeping
    document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
            await requestWakeLock();
        }
    });
};