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
    const incrementIntervalInput = document.getElementById('incrementInterval');
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
    Web Audio API
    ================*/
    let audioContext;
    let tickBuffer;
    let lowerTickBuffer;

    // Initialize Web Audio API
    function initAudio() {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        loadSound('../sounds/Perc_MetronomeQuartz_hi.mp3', buffer => tickBuffer = buffer);
        loadSound('../sounds/Perc_MetronomeQuartz_lo.mp3', buffer => lowerTickBuffer = buffer);
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

        if (isPlaying) {
            stopMetronome();
        } else {
            startMetronome();
        }
    }

    function startMetronome() {
        isPlaying = true;
        toggleButton.textContent = '⏹';

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
    }

    function stopMetronome() {
        isPlaying = false;
        toggleButton.textContent = '▶';
        clearInterval(intervalId);
        currentBeat = 0;
        blocks.forEach(block => block.classList.remove('active'));

        if (studyMode) {
            stopStudyMode();
        }
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
        const incrementInterval = parseInt(incrementIntervalInput.value) * 60 * 1000; // Convert minutes to milliseconds
        
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
        const incrementInterval = parseInt(incrementIntervalInput.value) * 60 * 1000;
        scheduleNextBpmIncrease(incrementInterval);
        resetCountdownTimer();
        startBeatInterval();
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
        countdownTime = parseInt(incrementIntervalInput.value) * 60;
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

    function updateTimerDisplay(timerElement, seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

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

    
};